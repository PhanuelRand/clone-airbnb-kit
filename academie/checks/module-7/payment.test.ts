/**
 * Module 7 — Paiement, versement à l'hôte et annulation.
 *
 * Contrat attendu, exporté par `src/academie/module-7.ts` :
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
 *   export function refundFor(input: {
 *     policy: 'FLEXIBLE' | 'MODERATE' | 'STRICT'
 *     totalCents: number
 *     checkIn: string          // 'AAAA-MM-JJ'
 *     cancelledAt: string      // 'AAAA-MM-JJ'
 *   }): { refundCents: number }
 *
 *   export function signWebhook(payload: string): string
 *   export function handleWebhook(input: {
 *     payload: string; signature: string
 *   }): Promise<{ status: number }>
 *
 * Barème de remboursement imposé par la consigne, où `joursAvant` est le nombre
 * de jours entiers entre l'annulation et l'arrivée :
 *
 *   FLEXIBLE   joursAvant >= 1  -> 100 %          sinon 0 %
 *   MODERATE   joursAvant >= 5  -> 100 %
 *              joursAvant >= 1  ->  50 %          sinon 0 %
 *   STRICT     joursAvant >= 7  ->  50 %          sinon 0 %
 *
 * Les pourcentages sont arrondis à l'entier inférieur.
 *
 * `signWebhook` n'existe que pour permettre à cette suite de fabriquer une
 * signature valide. Votre serveur, lui, vérifie celle du prestataire.
 *
 * Un événement `payment.succeeded` correctement signé doit enregistrer le débit
 * de la réservation qu'il désigne, exactement comme `capturePayment` le ferait,
 * et `listCharges` doit le voir. C'est le sens du module : un paiement est
 * acquis quand le prestataire le confirme, pas quand le navigateur du voyageur
 * affiche une page de succès.
 */
import { describe, expect, it } from 'vitest'
import {
  capturePayment,
  handleWebhook,
  listCharges,
  listPayouts,
  refundFor,
  releasePayout,
  signWebhook,
} from '../../../src/academie/module-7'

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

describe('barème de remboursement', () => {
  const total = 40_001

  const cases: {
    policy: 'FLEXIBLE' | 'MODERATE' | 'STRICT'
    cancelledAt: string
    expected: number
  }[] = [
    { policy: 'FLEXIBLE', cancelledAt: '2026-09-01', expected: total },
    { policy: 'FLEXIBLE', cancelledAt: '2026-09-09', expected: total },
    { policy: 'FLEXIBLE', cancelledAt: '2026-09-10', expected: 0 },
    { policy: 'MODERATE', cancelledAt: '2026-09-01', expected: total },
    { policy: 'MODERATE', cancelledAt: '2026-09-05', expected: total },
    { policy: 'MODERATE', cancelledAt: '2026-09-07', expected: Math.floor(total / 2) },
    { policy: 'MODERATE', cancelledAt: '2026-09-10', expected: 0 },
    { policy: 'STRICT', cancelledAt: '2026-09-01', expected: Math.floor(total / 2) },
    { policy: 'STRICT', cancelledAt: '2026-09-03', expected: Math.floor(total / 2) },
    { policy: 'STRICT', cancelledAt: '2026-09-05', expected: 0 },
  ]

  for (const scenario of cases) {
    it(`${scenario.policy}, annulée le ${scenario.cancelledAt}`, () => {
      const result = refundFor({
        policy: scenario.policy,
        totalCents: total,
        checkIn: '2026-09-10',
        cancelledAt: scenario.cancelledAt,
      })

      expect(result.refundCents).toBe(scenario.expected)
    })
  }

  it('ne rembourse jamais plus que le total, ni un montant négatif', () => {
    for (const policy of ['FLEXIBLE', 'MODERATE', 'STRICT'] as const) {
      for (const cancelledAt of ['2026-08-01', '2026-09-09', '2026-09-11']) {
        const { refundCents } = refundFor({
          policy,
          totalCents: total,
          checkIn: '2026-09-10',
          cancelledAt,
        })

        expect(Number.isInteger(refundCents)).toBe(true)
        expect(refundCents).toBeGreaterThanOrEqual(0)
        expect(refundCents).toBeLessThanOrEqual(total)
      }
    }
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
