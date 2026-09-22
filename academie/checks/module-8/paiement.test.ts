/**
 * Module 8 — Paiement et tarification, l'encaissement.
 *
 * Contrat attendu, exporté par `src/academie/module-8.ts`, en plus des
 * fonctions de devis :
 *
 *   export function capturePayment(input: {
 *     bookingId: string; amountCents: number; idempotencyKey: string
 *   }): Promise<{ chargeId: string; amountCents: number }>
 *
 *   export function listCharges(bookingId: string): Promise<
 *     { chargeId: string; amountCents: number }[]
 *   >
 *
 *   export function releasePayout(input: {
 *     bookingId: string; idempotencyKey: string
 *   }): Promise<{ payoutId: string; amountCents: number; feeCents: number }>
 *
 *   export function listPayouts(bookingId: string): Promise<
 *     { payoutId: string; amountCents: number }[]
 *   >
 *
 *   export function signWebhook(payload: string): string
 *   export function handleWebhook(input: {
 *     payload: string; signature: string
 *   }): Promise<{ status: number }>
 *
 * Les montants sont des entiers dans la plus petite unité de la monnaie :
 * des centimes pour l'euro, des ariary entiers pour l'ariary.
 *
 * `signWebhook` n'existe que pour permettre à cette suite de fabriquer une
 * signature valide. Votre serveur, lui, vérifie celle du prestataire.
 *
 * Un événement `payment.succeeded` correctement signé doit enregistrer le débit
 * de la réservation qu'il désigne, exactement comme `capturePayment` le ferait,
 * et `listCharges` doit le voir. Un paiement est acquis quand le prestataire le
 * confirme, pas quand le navigateur du voyageur affiche une page de succès.
 */
import { describe, expect, it } from 'vitest'
import {
  capturePayment,
  handleWebhook,
  listCharges,
  listPayouts,
  releasePayout,
  signWebhook,
} from '../../../src/academie/module-8'

function bookingId() {
  return `booking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

describe('encaissement du voyageur', () => {
  it('débite une fois et rend le montant demandé', async () => {
    const booking = bookingId()
    const charge = await capturePayment({
      bookingId: booking,
      amountCents: 42_000,
      idempotencyKey: `${booking}-capture`,
    })

    expect(charge.amountCents).toBe(42_000)
    expect(await listCharges(booking)).toHaveLength(1)
  })

  // Un appel réseau qui échoue ne veut pas dire que rien ne s'est passé.
  it('ne double pas le débit quand la même clé est rejouée', async () => {
    const booking = bookingId()
    const key = `${booking}-capture`

    const first = await capturePayment({ bookingId: booking, amountCents: 42_000, idempotencyKey: key })
    const replay = await capturePayment({ bookingId: booking, amountCents: 42_000, idempotencyKey: key })

    expect(replay.chargeId).toBe(first.chargeId)
    expect(await listCharges(booking)).toHaveLength(1)
  })

  it('ne double pas le débit sous appels simultanés', async () => {
    const booking = bookingId()
    const key = `${booking}-capture`

    await Promise.all(
      Array.from({ length: 4 }, () =>
        capturePayment({ bookingId: booking, amountCents: 42_000, idempotencyKey: key }),
      ),
    )

    expect(await listCharges(booking)).toHaveLength(1)
  })

  it('conserve le montant en entiers', async () => {
    const booking = bookingId()
    const charge = await capturePayment({
      bookingId: booking,
      amountCents: 23_750,
      idempotencyKey: `${booking}-capture`,
    })

    expect(Number.isInteger(charge.amountCents)).toBe(true)
    expect((await listCharges(booking))[0]?.amountCents).toBe(23_750)
  })
})

describe('versement à l’hôte', () => {
  async function paidBooking() {
    const booking = bookingId()
    await capturePayment({
      bookingId: booking,
      amountCents: 42_000,
      idempotencyKey: `${booking}-capture`,
    })
    return booking
  }

  it('verse le montant encaissé moins la commission', async () => {
    const booking = await paidBooking()
    const payout = await releasePayout({ bookingId: booking, idempotencyKey: `${booking}-payout` })

    expect(payout.feeCents, 'la plateforme prélève une commission').toBeGreaterThan(0)
    expect(payout.amountCents).toBe(42_000 - payout.feeCents)
    expect(Number.isInteger(payout.amountCents)).toBe(true)
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
    return JSON.stringify({ id, type: 'payment.succeeded', bookingId: booking, amountCents: 42_000 })
  }

  it('refuse un événement dont la signature est invalide', async () => {
    const payload = event('evt-invalide', bookingId())
    const response = await handleWebhook({ payload, signature: 'signature-inventee' })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it('accepte un événement correctement signé', async () => {
    const payload = event('evt-valide', bookingId())
    const response = await handleWebhook({ payload, signature: signWebhook(payload) })

    expect(response.status).toBeGreaterThanOrEqual(200)
    expect(response.status).toBeLessThan(300)
  })

  // Un prestataire redélivre ses événements : c'est normal, pas une anomalie.
  it('absorbe la redélivrance du même événement sans second effet', async () => {
    const booking = bookingId()
    const payload = event(`evt-${booking}`, booking)
    const signature = signWebhook(payload)

    await handleWebhook({ payload, signature })
    await handleWebhook({ payload, signature })

    expect(await listCharges(booking)).toHaveLength(1)
  })
})
