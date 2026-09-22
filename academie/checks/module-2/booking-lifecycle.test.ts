/**
 * Module 2 — Architecture, le cycle de vie d’une réservation.
 *
 * Suite de conformité écrite par l'Académie. Elle appelle VOTRE code à travers
 * l'adaptateur du module. Ces fichiers font partie du harnais : les modifier
 * confie votre remise à un mentor.
 *
 * Contrat attendu, exporté par `src/academie/module-2.ts` :
 *
 *   export type BookingStatus =
 *     'REQUESTED' | 'CONFIRMED' | 'CHECKED_IN'
 *     | 'COMPLETED' | 'CANCELLED' | 'DECLINED'
 *
 *   export class Booking {
 *     static request(input: {
 *       guestId: string
 *       listingId: string
 *       checkIn: string        // 'AAAA-MM-JJ', nuit d'arrivée incluse
 *       checkOut: string       // 'AAAA-MM-JJ', jour de départ EXCLU
 *       totalCents: number
 *       currency: string
 *     }): Booking              // lève si checkOut <= checkIn
 *     readonly status: BookingStatus
 *     readonly totalCents: number
 *     readonly nights: number
 *     transitionTo(next: BookingStatus): void   // lève si interdite
 *   }
 *
 * La convention de dates est la même dans tout le parcours : l'intervalle est
 * semi-ouvert. Un séjour du 1er au 4 mars compte trois nuits, et un séjour qui
 * commence le 4 ne chevauche pas le précédent. Le module 7 en dépend.
 */
import { describe, expect, it } from 'vitest'
import { Booking } from '../../../src/academie/module-2'

const guestId = '11111111-1111-4111-8111-111111111111'
const listingId = '22222222-2222-4222-8222-222222222222'

function requested() {
  return Booking.request({
    guestId,
    listingId,
    checkIn: '2026-03-01',
    checkOut: '2026-03-04',
    totalCents: 42000,
    currency: 'CAD',
  })
}

function advanceTo(booking: Booking, steps: string[]) {
  for (const step of steps) booking.transitionTo(step as never)
}

describe('cycle de vie d’une réservation', () => {
  it('naît à l’état demandé', () => {
    expect(requested().status).toBe('REQUESTED')
  })

  it('suit le chemin nominal jusqu’à la fin du séjour', () => {
    const booking = requested()
    advanceTo(booking, ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'])
    expect(booking.status).toBe('COMPLETED')
  })

  it('refuse de terminer un séjour jamais confirmé', () => {
    expect(() => requested().transitionTo('COMPLETED' as never)).toThrow()
  })

  it('refuse l’arrivée avant la confirmation', () => {
    expect(() => requested().transitionTo('CHECKED_IN' as never)).toThrow()
  })

  it('refuse de rouvrir un séjour terminé', () => {
    const booking = requested()
    advanceTo(booking, ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'])
    expect(() => booking.transitionTo('CHECKED_IN' as never)).toThrow()
  })

  it('refuse de reprendre une réservation annulée', () => {
    const booking = requested()
    booking.transitionTo('CANCELLED' as never)
    expect(() => booking.transitionTo('CONFIRMED' as never)).toThrow()
  })

  // Refuser est une réponse de l'hôte à une demande : une fois confirmée, la
  // sortie s'appelle une annulation, et le module 10 lui applique une politique.
  it('refuse de décliner une réservation déjà confirmée', () => {
    const booking = requested()
    booking.transitionTo('CONFIRMED' as never)
    expect(() => booking.transitionTo('DECLINED' as never)).toThrow()
  })

  it('accepte de décliner une demande encore en attente', () => {
    const booking = requested()
    booking.transitionTo('DECLINED' as never)
    expect(booking.status).toBe('DECLINED')
  })
})

describe('intervalle du séjour', () => {
  // Critère c3 : l'intervalle est semi-ouvert, le jour de départ est exclu.
  it('compte les nuits, pas les jours', () => {
    expect(requested().nights).toBe(3)
  })

  it('refuse un séjour dont le départ précède l’arrivée', () => {
    expect(() =>
      Booking.request({
        guestId,
        listingId,
        checkIn: '2026-03-04',
        checkOut: '2026-03-01',
        totalCents: 42000,
        currency: 'CAD',
      }),
    ).toThrow()
  })

  it('refuse un séjour de zéro nuit', () => {
    expect(() =>
      Booking.request({
        guestId,
        listingId,
        checkIn: '2026-03-01',
        checkOut: '2026-03-01',
        totalCents: 42000,
        currency: 'CAD',
      }),
    ).toThrow()
  })
})

describe('montant de la réservation', () => {
  // Critère c4 : un montant en virgule flottante finit par produire des écarts
  // sur un relevé bancaire, et un versement d'hôte faux.
  it('conserve le montant en entiers, jamais en virgule flottante', () => {
    const booking = requested()
    expect(Number.isInteger(booking.totalCents)).toBe(true)
    expect(booking.totalCents).toBe(42000)
  })
})
