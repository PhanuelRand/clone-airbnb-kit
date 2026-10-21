/**
 * Module 12 : Diagnostic de la double réservation.
 *
 * Au module 9, votre réservation a passé toutes ses vérifications. Elles
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
 * Contrat attendu, exporté par `src/academie/module-12.ts`, identique à celui
 * du module 9 : vous réexportez les mêmes fonctions.
 *
 *   export function createAccount(input: {
 *     roles: ('GUEST' | 'HOST')[]
 *   }): Promise<string>     // un compte au courriel inventé; un HOST est déjà approuvé
 *
 *   export function createListing(input: {
 *     hostId: string
 *     title?: string; city?: string            // par défaut 'Annonce', 'Antananarivo'
 *     nightlyPrice?: number; currency?: string // par défaut 100000, 'MGA'
 *     capacity?: number                        // par défaut 2
 *   }): Promise<string>
 *   export function requestBooking(input: {
 *     guestId: string; listingId: string; checkIn: string; checkOut: string
 *   }): Promise<{ accepted: boolean; bookingId?: string; reason?: string }>
 *   export function listBookings(listingId: string): Promise<
 *     { id: string; checkIn: string; checkOut: string; status: string }[]
 *   >
 */
import { beforeAll, describe, expect, it } from 'vitest'
import {
  createAccount,
  createListing,
  listBookings,
  requestBooking,
} from '../../../src/academie/module-12'

let hostId = ''
let guestId = ''

beforeAll(async () => {
  hostId = await createAccount({ roles: ['HOST'] })
  guestId = await createAccount({ roles: ['GUEST'] })
})

/** Des voyageurs distincts, créés avant d'envoyer les demandes. */
function guests(count: number) {
  return Promise.all(Array.from({ length: count }, () => createAccount({ roles: ['GUEST'] })))
}

function book(listingId: string, checkIn: string, checkOut: string, guest = guestId) {
  return requestBooking({ guestId: guest, listingId, checkIn, checkOut })
}

describe('demandes simultanées', () => {
  // Le test que seule une garantie de la base fait passer de façon fiable.
  it('désigne exactement un gagnant parmi cinq demandes identiques', async () => {
    const listingId = await createListing({ hostId })
    const travellers = await guests(5)

    const results = await Promise.all(
      travellers.map((traveller) => book(listingId, '2030-11-05', '2030-11-09', traveller)),
    )

    expect(results.filter((result) => result.accepted)).toHaveLength(1)
    expect(await listBookings(listingId)).toHaveLength(1)
  })

  it('désigne un seul gagnant parmi des intervalles qui se chevauchent partiellement', async () => {
    const listingId = await createListing({ hostId })
    const [a = '', b = '', c = ''] = await guests(3)

    const results = await Promise.all([
      book(listingId, '2030-11-05', '2030-11-10', a),
      book(listingId, '2030-11-08', '2030-11-12', b),
      book(listingId, '2030-11-09', '2030-11-15', c),
    ])

    expect(results.filter((result) => result.accepted).length).toBe(1)
  })

  it('laisse passer des demandes simultanées sur des intervalles disjoints', async () => {
    const listingId = await createListing({ hostId })
    const [a = '', b = '', c = ''] = await guests(3)

    const results = await Promise.all([
      book(listingId, '2030-12-01', '2030-12-05', a),
      book(listingId, '2030-12-05', '2030-12-09', b),
      book(listingId, '2030-12-09', '2030-12-13', c),
    ])

    expect(results.filter((result) => result.accepted)).toHaveLength(3)
  })
})
