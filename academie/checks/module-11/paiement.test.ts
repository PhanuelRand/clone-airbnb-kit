/**
 * Module 11 : Le paiement.
 *
 * Le prestataire de paiement est simulé : vous l'écrivez vous-même, dans votre
 * API. Il confirme les paiements et signe ses webhooks comme le ferait un vrai
 * prestataire, par exemple un service de Mobile Money. Aucun compte chez un
 * prestataire n'est nécessaire, et aucune carte bancaire.
 *
 * Contrat attendu, exporté par `src/academie/module-11.ts` :
 *
 *   export function createBooking(): Promise<{
 *     bookingId: string; guestId: string; hostId: string
 *   }>                       // une demande de réservation, avec ses deux comptes
 *
 *
 *   export function capturePayment(input: {
 *     bookingId: string; amount: number; idempotencyKey: string
 *   }): Promise<{ chargeId: string; amount: number }>
 *
 *   export function listCharges(bookingId: string): Promise<
 *     { chargeId: string; amount: number }[]
 *   >
 *
 *   export function releasePayout(input: {
 *     bookingId: string; idempotencyKey: string
 *   }): Promise<{ payoutId: string; amount: number; fee: number }>
 *
 *   export function listPayouts(bookingId: string): Promise<
 *     { payoutId: string; amount: number }[]
 *   >
 *
 *   export function signWebhook(payload: string): string
 *   export function handleWebhook(input: {
 *     payload: string; signature: string
 *   }): Promise<{ status: number }>
 *
 * Les montants sont des entiers dans la plus petite unité de la monnaie :
 * des ariary entiers pour l'ariary, qui n'a pas de centimes.
 *
 * `signWebhook` n'existe que pour permettre à cette suite de fabriquer une
 * signature valide. Votre serveur, lui, vérifie celle du prestataire.
 *
 * Un événement porte `{ id, type, bookingId, amount, idempotencyKey }`. Sa clé
 * d'idempotence est celle du paiement qu'il confirme : un débit déjà enregistré
 * par `capturePayment` sous cette clé ne se dédouble pas.
 *
 * Un événement `payment.succeeded` correctement signé doit enregistrer le débit
 * de la réservation qu'il désigne, exactement comme `capturePayment` le ferait,
 * et `listCharges` doit le voir. Un paiement est acquis quand le prestataire le
 * confirme, pas quand le navigateur du voyageur affiche une page de succès.
 */
import { describe, expect, it } from 'vitest'
import {
  capturePayment,
  createBooking,
  handleWebhook,
  listCharges,
  listPayouts,
  releasePayout,
  signWebhook,
} from '../../../src/academie/module-11'

async function bookingId() {
  return (await createBooking()).bookingId
}

describe('encaissement du voyageur', () => {
  it('débite une fois et rend le montant demandé', async () => {
    const booking = await bookingId()
    const charge = await capturePayment({
      bookingId: booking,
      amount: 42_000,
      idempotencyKey: `${booking}-capture`,
    })

    expect(charge.amount).toBe(42_000)
    expect(await listCharges(booking)).toHaveLength(1)
  })

  // Un appel réseau qui échoue ne veut pas dire que rien ne s'est passé.
  it('ne double pas le débit quand la même clé est rejouée', async () => {
    const booking = await bookingId()
    const key = `${booking}-capture`

    const first = await capturePayment({ bookingId: booking, amount: 42_000, idempotencyKey: key })
    const replay = await capturePayment({ bookingId: booking, amount: 42_000, idempotencyKey: key })

    expect(replay.chargeId).toBe(first.chargeId)
    expect(await listCharges(booking)).toHaveLength(1)
  })

  it('ne double pas le débit sous appels simultanés', async () => {
    const booking = await bookingId()
    const key = `${booking}-capture`

    await Promise.all(
      Array.from({ length: 4 }, () =>
        capturePayment({ bookingId: booking, amount: 42_000, idempotencyKey: key }),
      ),
    )

    expect(await listCharges(booking)).toHaveLength(1)
  })

  it('conserve le montant en entiers', async () => {
    const booking = await bookingId()
    const charge = await capturePayment({
      bookingId: booking,
      amount: 23_750,
      idempotencyKey: `${booking}-capture`,
    })

    expect(Number.isInteger(charge.amount)).toBe(true)
    expect((await listCharges(booking))[0]?.amount).toBe(23_750)
  })
})

describe('versement à l’hôte', () => {
  async function paidBooking() {
    const booking = await bookingId()
    await capturePayment({
      bookingId: booking,
      amount: 42_000,
      idempotencyKey: `${booking}-capture`,
    })
    return booking
  }

  it('verse le montant encaissé moins la commission', async () => {
    const booking = await paidBooking()
    const payout = await releasePayout({ bookingId: booking, idempotencyKey: `${booking}-payout` })

    expect(payout.fee, 'la plateforme prélève une commission').toBeGreaterThan(0)
    expect(payout.amount).toBe(42_000 - payout.fee)
    expect(Number.isInteger(payout.amount)).toBe(true)
  })

  it('ne verse jamais deux fois sur la même clé', async () => {
    const booking = await paidBooking()
    const key = `${booking}-payout`

    const first = await releasePayout({ bookingId: booking, idempotencyKey: key })
    const replay = await releasePayout({ bookingId: booking, idempotencyKey: key })

    expect(replay.payoutId).toBe(first.payoutId)
    expect(await listPayouts(booking)).toHaveLength(1)
  })
})

describe('webhooks du prestataire', () => {
  function event(id: string, booking: string) {
    return JSON.stringify({
      id,
      type: 'payment.succeeded',
      bookingId: booking,
      amount: 42_000,
      idempotencyKey: `${booking}-capture`,
    })
  }

  it('refuse un événement dont la signature est invalide', async () => {
    const payload = event(`evt-invalide-${Date.now()}`, await bookingId())
    const response = await handleWebhook({ payload, signature: 'signature-inventee' })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it('accepte un événement correctement signé', async () => {
    const payload = event(`evt-valide-${Date.now()}`, await bookingId())
    const response = await handleWebhook({ payload, signature: signWebhook(payload) })

    expect(response.status).toBeGreaterThanOrEqual(200)
    expect(response.status).toBeLessThan(300)
  })

  // Un prestataire redélivre ses événements : c'est normal, pas une anomalie.
  it('absorbe la redélivrance du même événement sans second effet', async () => {
    const booking = await bookingId()
    const payload = event(`evt-${booking}`, booking)
    const signature = signWebhook(payload)

    await handleWebhook({ payload, signature })
    await handleWebhook({ payload, signature })

    expect(await listCharges(booking)).toHaveLength(1)
  })
})
