/**
 * Module 9 — Diagnostic : la double réservation.
 *
 * Au module 7, votre réservation a passé toutes ses vérifications. Elles
 * envoyaient les demandes une par une. Celles-ci les envoient en même temps.
 *
 * Une implémentation qui vérifie que les dates sont libres, puis insère la
 * réservation, laisse une fenêtre entre les deux : cinq demandes identiques
 * peuvent toutes constater que le logement est libre avant que la première
 * n'écrive. Aucun test séquentiel ne la voit, et c'est pourquoi ce défaut
 * passe en local et casse en production.
 *
 * La garantie doit venir de la base : une contrainte d'exclusion sur un
 * `daterange`, avec l'extension `btree_gist` pour joindre l'identifiant du
 * logement à l'intervalle.
 *
 * Contrat attendu, exporté par `src/academie/module-9.ts`, identique à celui
 * du module 7 : vous réexportez les mêmes fonctions.
 *
 *   export function createListing(input: { hostId: string }): Promise<string>
 *   export function requestBooking(input: {
 *     guestId: string; listingId: string; checkIn: string; checkOut: string
 *   }): Promise<{ accepted: boolean; bookingId?: string; reason?: string }>
 *   export function listBookings(listingId: string): Promise<
 *     { id: string; checkIn: string; checkOut: string; status: string }[]
 *   >
 */
import { describe, expect, it } from 'vitest'
import { createListing, listBookings, requestBooking } from '../../../src/academie/module-9'

const hostId = '66666666-6666-4666-8666-666666666666'
const guestId = '77777777-7777-4777-8777-777777777777'

function book(listingId: string, checkIn: string, checkOut: string, guest = guestId) {
  return requestBooking({ guestId: guest, listingId, checkIn, checkOut })
}

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
