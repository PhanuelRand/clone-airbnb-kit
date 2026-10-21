/**
 * Module 7 : Recherche et filtres.
 *
 * Un voyageur arrive avec une ville, un nombre de voyageurs, un budget et des
 * commodités. La recherche rend exactement les logements qui conviennent, page
 * par page.
 *
 * Contrat attendu, exporté par `src/academie/module-7.ts` :
 *
 *   export function createAccount(input: {
 *     roles: ('GUEST' | 'HOST')[]
 *   }): Promise<string>          // un compte au courriel inventé; un HOST est déjà approuvé
 *
 *   export function publishListing(input: {
 *     hostId: string; city: string; title: string
 *     nightlyPrice: number; capacity: number; amenities: string[]
 *     latitude?: number; longitude?: number   // en degrés décimaux, au module 8
 *   }): Promise<string>          // crée l'annonce et la publie
 *
 *   export function search(input: {
 *     city?: string
 *     guests?: number
 *     minPrice?: number; maxPrice?: number    // prix par nuit, en ariary entiers
 *     amenities?: string[]                    // toutes exigées
 *     cursor?: string | null; limit?: number
 *   }): Promise<{
 *     items: { listingId: string; nightlyPrice: number }[]
 *     nextCursor: string | null
 *   }>
 *
 * La pagination est par curseur, jamais par OFFSET : une annonce publiée
 * pendant que l'on feuillette ne doit ni décaler ni dupliquer les résultats
 * déjà vus. Le curseur est un marque-page : la page suivante reprend après le
 * dernier logement rendu.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createAccount, publishListing, search } from '../../../src/academie/module-7'

let hostId = ''

beforeAll(async () => {
  hostId = await createAccount({ roles: ['HOST'] })
})

// Chaque test travaille dans sa propre ville : les suites ne se polluent pas.
function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function publish(city: string, overrides: Partial<Parameters<typeof publishListing>[0]> = {}) {
  return publishListing({
    hostId,
    city,
    title: 'Annonce de vérification',
    nightlyPrice: 20_000,
    capacity: 2,
    amenities: ['wifi'],
    ...overrides,
  })
}

async function allPages(city: string, limit: number) {
  const seen: string[] = []
  let cursor: string | null = null

  for (let page = 0; page < 20; page += 1) {
    const result: Awaited<ReturnType<typeof search>> = await search({ city, cursor, limit })
    seen.push(...result.items.map((item) => item.listingId))
    cursor = result.nextCursor
    if (!cursor) break
  }

  return seen
}

describe('filtres de recherche', () => {
  it('ne rend que les annonces de la ville demandée', async () => {
    const city = uniqueCity('tana')
    const wanted = await publish(city)
    await publish(uniqueCity('tamatave'))

    const result = await search({ city })
    expect(result.items.map((item) => item.listingId)).toEqual([wanted])
  })

  it('exclut les annonces trop petites pour le nombre de voyageurs', async () => {
    const city = uniqueCity('capacite')
    const large = await publish(city, { capacity: 6 })
    await publish(city, { capacity: 2 })

    const result = await search({ city, guests: 5 })
    expect(result.items.map((item) => item.listingId)).toEqual([large])
  })

  it('respecte la fourchette de prix', async () => {
    const city = uniqueCity('prix')
    const cheap = await publish(city, { nightlyPrice: 10_000 })
    await publish(city, { nightlyPrice: 90_000 })

    const result = await search({ city, minPrice: 5_000, maxPrice: 50_000 })
    expect(result.items.map((item) => item.listingId)).toEqual([cheap])
  })

  it('exige toutes les commodités demandées, pas une seule', async () => {
    const city = uniqueCity('commodites')
    const complete = await publish(city, { amenities: ['wifi', 'climatisation', 'piscine'] })
    await publish(city, { amenities: ['wifi'] })

    const result = await search({ city, amenities: ['wifi', 'climatisation'] })
    expect(result.items.map((item) => item.listingId)).toEqual([complete])
  })
})

describe('pagination par curseur', () => {
  it('parcourt toutes les annonces sans doublon ni oubli', async () => {
    const city = uniqueCity('pagination')
    const published = []
    for (let index = 0; index < 7; index += 1) published.push(await publish(city))

    const seen = await allPages(city, 3)

    expect(seen).toHaveLength(published.length)
    expect(new Set(seen).size).toBe(published.length)
    expect([...seen].sort()).toEqual([...published].sort())
  })

  // Le test que OFFSET ne passe pas : une insertion décale toutes les pages.
  it('ne décale pas les pages déjà vues quand une annonce est publiée entre deux', async () => {
    const city = uniqueCity('insertion')
    for (let index = 0; index < 6; index += 1) await publish(city)

    const first = await search({ city, limit: 3 })
    expect(first.nextCursor, 'six annonces par pages de trois : il reste une page').toBeTruthy()

    await publish(city)

    const second = await search({ city, cursor: first.nextCursor, limit: 3 })
    const overlap = second.items
      .map((item) => item.listingId)
      .filter((id) => first.items.some((item) => item.listingId === id))

    expect(overlap, 'aucune annonce de la page 1 ne doit réapparaître page 2').toEqual([])
  })
})
