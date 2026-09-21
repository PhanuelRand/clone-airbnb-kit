/**
 * Module 6 — Réservation sans double réservation.
 *
 * Le critère central du parcours : un logement n'a jamais deux réservations
 * actives sur la même nuit, même sous demandes simultanées. Une lecture suivie
 * d'une écriture ne suffit pas — il faut une garantie de la base. La réponse
 * attendue est une contrainte d'exclusion sur un `daterange`, avec l'extension
 * `btree_gist` pour joindre l'identifiant du logement à l'intervalle.
 *
 * Contrat attendu, exporté par `src/academie/module-7.ts` :
 *
 *   export function createListing(input: { hostId: string }): Promise<string>
 *
 *   export function requestBooking(input: {
 *     guestId: string; listingId: string
 *     checkIn: string; checkOut: string      // intervalle semi-ouvert
 *   }): Promise<{ accepted: boolean; bookingId?: string; reason?: string }>
 *
 *   export function cancelBooking(input: { bookingId: string }): Promise<void>
 *
 *   export function listBookings(listingId: string): Promise<
 *     { id: string; checkIn: string; checkOut: string; status: string }[]
 *   >
 *
 * Rappel de la convention : le jour de départ est EXCLU. Un séjour qui
 * commence le jour où un autre se termine ne chevauche pas.
 */
import { describe, expect, it } from 'vitest'
import {
  cancelBooking,
  createListing,
  listBookings,
  requestBooking,
} from '../../../src/academie/module-7'

const hostId = '66666666-6666-4666-8666-666666666666'
const guestId = '77777777-7777-4777-8777-777777777777'

function book(listingId: string, checkIn: string, checkOut: string, guest = guestId) {
  return requestBooking({ guestId: guest, listingId, checkIn, checkOut })
}

describe('réservation d’un intervalle libre', () => {
  it('accepte une première demande et rend son identifiant', async () => {
    const listingId = await createListing({ hostId })
    const result = await book(listingId, '2026-09-10', '2026-09-14')

    expect(result.accepted).toBe(true)
    expect(result.bookingId, 'une réservation acceptée porte un identifiant').toBeTruthy()
  })

  it('accepte deux séjours qui ne se touchent pas', async () => {
    const listingId = await createListing({ hostId })

    expect((await book(listingId, '2026-09-10', '2026-09-14')).accepted).toBe(true)
    expect((await book(listingId, '2026-09-20', '2026-09-24')).accepted).toBe(true)
    expect(await listBookings(listingId)).toHaveLength(2)
  })

  // La convention semi-ouverte, vérifiée là où elle compte.
  it('accepte un séjour qui commence le jour du départ du précédent', async () => {
    const listingId = await createListing({ hostId })

    expect((await book(listingId, '2026-09-10', '2026-09-14')).accepted).toBe(true)
    expect((await book(listingId, '2026-09-14', '2026-09-18')).accepted).toBe(true)
  })

  it('n’oppose pas les réservations de deux logements différents', async () => {
    const first = await createListing({ hostId })
    const second = await createListing({ hostId })

    expect((await book(first, '2026-09-10', '2026-09-14')).accepted).toBe(true)
    expect((await book(second, '2026-09-10', '2026-09-14')).accepted).toBe(true)
  })
})

describe('chevauchements refusés', () => {
  const occupied = { checkIn: '2026-10-10', checkOut: '2026-10-20' }

  const overlaps: { label: string; checkIn: string; checkOut: string }[] = [
    { label: 'identique', checkIn: '2026-10-10', checkOut: '2026-10-20' },
    { label: 'contenu', checkIn: '2026-10-12', checkOut: '2026-10-15' },
    { label: 'englobant', checkIn: '2026-10-05', checkOut: '2026-10-25' },
    { label: 'débordant par la fin', checkIn: '2026-10-18', checkOut: '2026-10-25' },
    { label: 'débordant par le début', checkIn: '2026-10-05', checkOut: '2026-10-12' },
    { label: 'chevauchant une seule nuit', checkIn: '2026-10-19', checkOut: '2026-10-24' },
  ]

  for (const overlap of overlaps) {
    it(`refuse un séjour ${overlap.label}`, async () => {
      const listingId = await createListing({ hostId })
      await book(listingId, occupied.checkIn, occupied.checkOut)

      const result = await book(listingId, overlap.checkIn, overlap.checkOut)
      expect(result.accepted, `le cas « ${overlap.label} » doit être refusé`).toBe(false)
      expect(result.reason, 'le refus doit porter un motif lisible').toBeTruthy()
      expect(await listBookings(listingId)).toHaveLength(1)
    })
  }
})

describe('demandes simultanées', () => {
  // Le test que seule une garantie de la base fait passer de façon fiable.
  it('désigne exactement un gagnant parmi cinq demandes identiques', async () => {
    const listingId = await createListing({ hostId })

    const results = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        book(listingId, '2026-11-05', '2026-11-09', `guest-${index}`),
      ),
    )

    expect(results.filter((result) => result.accepted)).toHaveLength(1)
    expect(await listBookings(listingId)).toHaveLength(1)
  })

  it('désigne un seul gagnant parmi des intervalles qui se chevauchent partiellement', async () => {
    const listingId = await createListing({ hostId })

    const results = await Promise.all([
      book(listingId, '2026-11-05', '2026-11-10', 'guest-a'),
      book(listingId, '2026-11-08', '2026-11-12', 'guest-b'),
      book(listingId, '2026-11-09', '2026-11-15', 'guest-c'),
    ])

    expect(results.filter((result) => result.accepted).length).toBe(1)
  })

  it('laisse passer des demandes simultanées sur des intervalles disjoints', async () => {
    const listingId = await createListing({ hostId })

    const results = await Promise.all([
      book(listingId, '2026-12-01', '2026-12-05', 'guest-a'),
      book(listingId, '2026-12-05', '2026-12-09', 'guest-b'),
      book(listingId, '2026-12-09', '2026-12-13', 'guest-c'),
    ])

    expect(results.filter((result) => result.accepted)).toHaveLength(3)
  })
})

describe('libération des dates', () => {
  it('rend les nuits réservables après une annulation', async () => {
    const listingId = await createListing({ hostId })
    const first = await book(listingId, '2026-09-10', '2026-09-14')
    expect(first.bookingId).toBeTruthy()
    if (!first.bookingId) return

    expect((await book(listingId, '2026-09-11', '2026-09-13')).accepted).toBe(false)

    await cancelBooking({ bookingId: first.bookingId })
    expect((await book(listingId, '2026-09-11', '2026-09-13')).accepted).toBe(true)
  })

  it('ne compte plus une réservation annulée comme active', async () => {
    const listingId = await createListing({ hostId })
    const booking = await book(listingId, '2026-09-10', '2026-09-14')
    if (!booking.bookingId) return

    await cancelBooking({ bookingId: booking.bookingId })
    const active = (await listBookings(listingId)).filter(
      (entry) => entry.status !== 'CANCELLED',
    )

    expect(active).toHaveLength(0)
  })
})
