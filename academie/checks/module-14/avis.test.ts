/**
 * Module 14 — Avis croisés. Module Platine.
 *
 * Après un séjour, le voyageur note l'hôte et l'hôte note le voyageur. Les avis
 * sont publiés en double aveugle : aucun ne voit l'avis de l'autre avant
 * d'avoir déposé le sien. Sans cette règle, le second à écrire répond au
 * premier, et les notes ne mesurent plus le séjour.
 *
 * Règles imposées :
 *
 * - un seul avis par séjour et par côté; seuls le voyageur et l'hôte du séjour
 *   en déposent un;
 * - une note est un entier de 1 à 5;
 * - les avis d'un séjour sont publiés quand les deux sont déposés, ou quatorze
 *   jours après le départ, même s'il n'y en a qu'un;
 * - passé ces quatorze jours, on ne dépose plus d'avis;
 * - la note d'un hôte est la moyenne des avis publiés de ses voyageurs,
 *   arrondie au dixième.
 *
 * Contrat attendu, exporté par `src/academie/module-14.ts` :
 *
 *   export function completeStay(input: {
 *     guestId: string; hostId: string; checkOut: string   // 'AAAA-MM-JJ'
 *   }): Promise<string>                                    // l'identifiant du séjour
 *
 *   export function submitReview(input: {
 *     stayId: string; authorId: string
 *     rating: number; comment: string
 *     submittedAt: string                                  // 'AAAA-MM-JJ'
 *   }): Promise<{ status: number }>    // 201, 400, 403, 409 (déjà déposé) ou 410 (trop tard)
 *
 *   export function publicReviews(input: {
 *     stayId: string; now: string                          // 'AAAA-MM-JJ'
 *   }): Promise<{ authorId: string; rating: number; comment: string }[]>
 *
 *   export function hostRating(input: {
 *     hostId: string; now: string
 *   }): Promise<{ average: number | null; count: number }>
 *
 * Les dates sont passées en paramètre plutôt que lues sur l'horloge : c'est ce
 * qui rend la règle des quatorze jours vérifiable sans attendre quatorze jours.
 */
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { completeStay, hostRating, publicReviews, submitReview } from '../../../src/academie/module-14'

const guestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const strangerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const checkOut = '2026-08-10'
const duringWindow = '2026-08-12'
const afterWindow = '2026-08-25'

/** Chaque test a son propre hôte, pour que les moyennes ne se mélangent pas. */
async function stay(hostId = randomUUID(), guest = guestId) {
  const stayId = await completeStay({ guestId: guest, hostId, checkOut })
  return { stayId, hostId }
}

function review(stayId: string, authorId: string, rating = 5, submittedAt = duringWindow) {
  return submitReview({ stayId, authorId, rating, comment: 'Séjour conforme', submittedAt })
}

describe('dépôt d’un avis', () => {
  it('accepte un avis de chaque côté du séjour', async () => {
    const { stayId, hostId } = await stay()
    expect((await review(stayId, guestId)).status).toBe(201)
    expect((await review(stayId, hostId)).status).toBe(201)
  })

  it('refuse un second avis du même côté avec 409', async () => {
    const { stayId } = await stay()
    await review(stayId, guestId, 4)
    expect((await review(stayId, guestId, 1)).status).toBe(409)
  })

  it('refuse l’avis d’une personne étrangère au séjour avec 403', async () => {
    const { stayId } = await stay()
    expect((await review(stayId, strangerId)).status).toBe(403)
  })

  it('refuse une note hors de 1 à 5, ou non entière, avec 400', async () => {
    const { stayId } = await stay()
    for (const rating of [0, 6, 3.5, -1]) {
      expect((await review(stayId, guestId, rating)).status, `note ${rating}`).toBe(400)
    }
  })

  it('refuse un avis déposé plus de quatorze jours après le départ avec 410', async () => {
    const { stayId } = await stay()
    expect((await review(stayId, guestId, 5, afterWindow)).status).toBe(410)
  })
})

describe('publication en double aveugle', () => {
  it('ne publie rien tant qu’un seul côté a déposé son avis', async () => {
    const { stayId } = await stay()
    await review(stayId, guestId)
    expect(await publicReviews({ stayId, now: duringWindow })).toEqual([])
  })

  it('publie les deux avis dès que le second est déposé', async () => {
    const { stayId, hostId } = await stay()
    await review(stayId, guestId, 5)
    await review(stayId, hostId, 4)

    const published = await publicReviews({ stayId, now: duringWindow })
    expect(published.map((entry) => entry.authorId).sort()).toEqual([guestId, hostId].sort())
  })

  it('publie un avis seul une fois les quatorze jours écoulés', async () => {
    const { stayId } = await stay()
    await review(stayId, guestId, 3)

    const published = await publicReviews({ stayId, now: afterWindow })
    expect(published).toHaveLength(1)
    expect(published[0]?.rating).toBe(3)
  })
})

describe('note de l’hôte', () => {
  it('ne compte que les avis publiés, pas ceux encore cachés', async () => {
    const { stayId, hostId } = await stay()
    await review(stayId, guestId, 2)

    expect(await hostRating({ hostId, now: duringWindow })).toEqual({ average: null, count: 0 })
    expect(await hostRating({ hostId, now: afterWindow })).toEqual({ average: 2, count: 1 })
  })

  it('fait la moyenne des voyageurs, arrondie au dixième, sans l’avis de l’hôte', async () => {
    const hostId = randomUUID()
    const ratings = [5, 4, 4]
    for (const rating of ratings) {
      const guest = randomUUID()
      const { stayId } = await stay(hostId, guest)
      await review(stayId, guest, rating)
      await review(stayId, hostId, 1)
    }

    // (5 + 4 + 4) / 3 = 4,333… donc 4,3. L'avis de l'hôte sur ses voyageurs
    // ne compte pas dans sa propre note.
    expect(await hostRating({ hostId, now: duringWindow })).toEqual({ average: 4.3, count: 3 })
  })
})
