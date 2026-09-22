/**
 * Module 7 — Réservation et calendrier.
 *
 * Une réservation accepte un intervalle libre et refuse tout chevauchement,
 * une demande à la fois. La convention est celle du module 2 : le jour de
 * départ est EXCLU, donc un séjour qui commence le jour où un autre se termine
 * ne le chevauche pas.
 *
 * Les demandes simultanées ne sont pas vérifiées ici, mais au module 9. C'est
 * voulu : une implémentation qui lit puis écrit passe cette suite et échoue
 * celle-là, et c'est ce que le module 9 apprend à diagnostiquer.
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
 *   export function respondToBooking(input: {
 *     bookingId: string; hostId: string; decision: 'ACCEPT' | 'DECLINE'
 *   }): Promise<{ status: number }>          // 200, ou 403 pour un autre que l'hôte
 *
 *   export function blockDates(input: {
 *     listingId: string; hostId: string
 *     from: string; to: string               // intervalle semi-ouvert
 *   }): Promise<{ status: number }>          // 201, ou 403 pour un autre que l'hôte
 *
 *   export function listBookings(listingId: string): Promise<
 *     { id: string; checkIn: string; checkOut: string; status: string }[]
 *   >
 *
 * Une demande acceptée par `requestBooking` retient les dates et attend la
 * réponse de l'hôte, au statut PENDING. L'hôte la confirme (CONFIRMED) ou la
 * décline (DECLINED); une demande déclinée libère ses dates. Les dates que
 * l'hôte bloque, pour un usage personnel ou des travaux, se refusent comme une
 * réservation.
 */
import { describe, expect, it } from 'vitest'
import {
  blockDates,
  cancelBooking,
  createListing,
  listBookings,
  requestBooking,
  respondToBooking,
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

describe('réponse de l’hôte', () => {
  it('laisse une nouvelle demande en attente de l’hôte', async () => {
    const listingId = await createListing({ hostId })
    const request = await book(listingId, '2026-11-02', '2026-11-05')

    const [booking] = await listBookings(listingId)
    expect(booking?.id).toBe(request.bookingId)
    expect(booking?.status).toBe('PENDING')
  })

  it('confirme la réservation quand l’hôte l’accepte', async () => {
    const listingId = await createListing({ hostId })
    const request = await book(listingId, '2026-11-02', '2026-11-05')
    if (!request.bookingId) throw new Error('la demande aurait dû être retenue')

    const answer = await respondToBooking({ bookingId: request.bookingId, hostId, decision: 'ACCEPT' })
    expect(answer.status).toBe(200)
    expect((await listBookings(listingId))[0]?.status).toBe('CONFIRMED')
  })

  it('libère les dates quand l’hôte décline', async () => {
    const listingId = await createListing({ hostId })
    const request = await book(listingId, '2026-11-02', '2026-11-05')
    if (!request.bookingId) throw new Error('la demande aurait dû être retenue')

    await respondToBooking({ bookingId: request.bookingId, hostId, decision: 'DECLINE' })
    expect((await book(listingId, '2026-11-03', '2026-11-04')).accepted).toBe(true)
  })

  // Côté serveur : connaître l'identifiant d'une demande ne suffit pas à y répondre.
  it('refuse la réponse de quelqu’un d’autre que l’hôte avec 403', async () => {
    const listingId = await createListing({ hostId })
    const request = await book(listingId, '2026-11-02', '2026-11-05')
    if (!request.bookingId) throw new Error('la demande aurait dû être retenue')

    const answer = await respondToBooking({
      bookingId: request.bookingId,
      hostId: guestId,
      decision: 'ACCEPT',
    })
    expect(answer.status).toBe(403)
    expect((await listBookings(listingId))[0]?.status).toBe('PENDING')
  })
})

describe('dates bloquées par l’hôte', () => {
  it('refuse une demande sur des dates bloquées, avec un motif', async () => {
    const listingId = await createListing({ hostId })
    expect((await blockDates({ listingId, hostId, from: '2026-12-20', to: '2026-12-27' })).status).toBe(
      201,
    )

    const result = await book(listingId, '2026-12-24', '2026-12-26')
    expect(result.accepted).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('garde réservable le jour où le blocage se termine', async () => {
    const listingId = await createListing({ hostId })
    await blockDates({ listingId, hostId, from: '2026-12-20', to: '2026-12-27' })

    expect((await book(listingId, '2026-12-27', '2026-12-30')).accepted).toBe(true)
  })

  it('ne laisse que l’hôte du logement bloquer ses dates', async () => {
    const listingId = await createListing({ hostId })
    const result = await blockDates({ listingId, hostId: guestId, from: '2026-12-20', to: '2026-12-27' })

    expect(result.status).toBe(403)
    expect((await book(listingId, '2026-12-21', '2026-12-23')).accepted).toBe(true)
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
