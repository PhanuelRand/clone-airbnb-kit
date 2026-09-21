/**
 * Module 4 — Recherche, filtres et disponibilité.
 *
 * Contrat attendu, exporté par `src/academie/module-5.ts` :
 *
 *   export function publishListing(input: {
 *     hostId: string; city: string; title: string
 *     nightlyCents: number; capacity: number; amenities: string[]
 *   }): Promise<string>
 *
 *   export function bookDates(input: {
 *     listingId: string; checkIn: string; checkOut: string
 *   }): Promise<void>            // met l'annonce à l'état réservé sur ces nuits
 *
 *   export function search(input: {
 *     city?: string
 *     checkIn?: string; checkOut?: string     // intervalle semi-ouvert
 *     guests?: number
 *     minCents?: number; maxCents?: number
 *     amenities?: string[]                    // toutes exigées
 *     cursor?: string | null; limit?: number
 *   }): Promise<{
 *     items: { listingId: string; nightlyCents: number }[]
 *     nextCursor: string | null
 *   }>
 *
 * La pagination est par curseur, jamais par OFFSET : la consigne exige qu'une
 * annonce publiée pendant que l'on feuillette ne décale ni ne duplique les
 * résultats déjà vus.
 */
import { describe, expect, it } from 'vitest'
import { bookDates, publishListing, search } from '../../../src/academie/module-5'

const hostId = '44444444-4444-4444-8444-444444444444'

// Chaque test travaille dans sa propre ville : les suites ne se polluent pas.
function uniqueCity(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function publish(city: string, overrides: Partial<Parameters<typeof publishListing>[0]> = {}) {
  return publishListing({
    hostId,
    city,
    title: 'Annonce de vérification',
    nightlyCents: 20_000,
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
    const cheap = await publish(city, { nightlyCents: 10_000 })
    await publish(city, { nightlyCents: 90_000 })

    const result = await search({ city, minCents: 5_000, maxCents: 50_000 })
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

describe('disponibilité dans la recherche', () => {
  it('exclut une annonce déjà réservée sur l’intervalle demandé', async () => {
    const city = uniqueCity('occupee')
    const booked = await publish(city)
    const free = await publish(city)
    await bookDates({ listingId: booked, checkIn: '2026-07-10', checkOut: '2026-07-15' })

    const result = await search({ city, checkIn: '2026-07-12', checkOut: '2026-07-14' })
    expect(result.items.map((item) => item.listingId)).toEqual([free])
  })

  it('exclut une annonce dont la réservation ne chevauche que d’une nuit', async () => {
    const city = uniqueCity('chevauchement')
    const booked = await publish(city)
    await bookDates({ listingId: booked, checkIn: '2026-07-10', checkOut: '2026-07-15' })

    const result = await search({ city, checkIn: '2026-07-14', checkOut: '2026-07-18' })
    expect(result.items).toHaveLength(0)
  })

  // L'intervalle est semi-ouvert : arriver le jour du départ ne chevauche pas.
  it('garde disponible une annonce libérée le jour de l’arrivée demandée', async () => {
    const city = uniqueCity('adjacent')
    const booked = await publish(city)
    await bookDates({ listingId: booked, checkIn: '2026-07-10', checkOut: '2026-07-15' })

    const result = await search({ city, checkIn: '2026-07-15', checkOut: '2026-07-18' })
    expect(result.items.map((item) => item.listingId)).toEqual([booked])
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
