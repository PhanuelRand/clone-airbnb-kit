/**
 * Module 8 : Carte et disponibilité.
 *
 * La recherche du module 7 apprend deux choses : ne rendre que les logements
 * libres sur les dates demandées, et chercher dans la zone que le voyageur
 * regarde sur la carte.
 *
 * Contrat attendu, exporté par `src/academie/module-8.ts` : les fonctions du
 * module 7, plus `blockDates`, et `search` accepte deux filtres de plus.
 *
 *   export function createAccount(input: { roles: ('GUEST' | 'HOST')[] }): Promise<string>
 *
 *   export function publishListing(input: {
 *     hostId: string; city: string; title: string
 *     nightlyPrice: number; capacity: number; amenities: string[]
 *     latitude?: number; longitude?: number
 *   }): Promise<string>
 *
 *   export function blockDates(input: {
 *     listingId: string; hostId: string
 *     from: string; to: string               // 'AAAA-MM-JJ', intervalle semi-ouvert
 *   }): Promise<{ status: number }>          // 201, ou 403 pour un autre que l'hôte
 *
 *   export function search(input: {
 *     city?: string; guests?: number
 *     checkIn?: string; checkOut?: string     // intervalle semi-ouvert
 *     bounds?: { south: number; west: number; north: number; east: number }
 *     cursor?: string | null; limit?: number
 *   }): Promise<{ items: { listingId: string; nightlyPrice: number }[]; nextCursor: string | null }>
 *
 * Une annonce dont une nuit de l'intervalle est bloquée ou réservée n'apparaît
 * pas. La convention est celle du module 2 : le jour de départ est exclu.
 *
 * La recherche par zone rend les annonces dont la position tombe dans le
 * rectangle visible de la carte, bords compris. Une annonce sans position n'y
 * figure pas. Une latitude et une longitude indexées suffisent : PostGIS n'est
 * pas nécessaire. Attention au signe : Madagascar est dans l'hémisphère sud,
 * donc ses latitudes sont négatives et le sud est le plus petit nombre.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { blockDates, createAccount, publishListing, search } from '../../../src/academie/module-8'

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

describe('disponibilité dans la recherche', () => {
  it('exclut une annonce déjà réservée sur l’intervalle demandé', async () => {
    const city = uniqueCity('occupee')
    const booked = await publish(city)
    const free = await publish(city)
    await blockDates({ listingId: booked, hostId, from: '2030-07-10', to: '2030-07-15' })

    const result = await search({ city, checkIn: '2030-07-12', checkOut: '2030-07-14' })
    expect(result.items.map((item) => item.listingId)).toEqual([free])
  })

  it('exclut une annonce dont la réservation ne chevauche que d’une nuit', async () => {
    const city = uniqueCity('chevauchement')
    const booked = await publish(city)
    await blockDates({ listingId: booked, hostId, from: '2030-07-10', to: '2030-07-15' })

    const result = await search({ city, checkIn: '2030-07-14', checkOut: '2030-07-18' })
    expect(result.items).toHaveLength(0)
  })

  // L'intervalle est semi-ouvert : arriver le jour du départ ne chevauche pas.
  it('garde disponible une annonce libérée le jour de l’arrivée demandée', async () => {
    const city = uniqueCity('adjacent')
    const booked = await publish(city)
    await blockDates({ listingId: booked, hostId, from: '2030-07-10', to: '2030-07-15' })

    const result = await search({ city, checkIn: '2030-07-15', checkOut: '2030-07-18' })
    expect(result.items.map((item) => item.listingId)).toEqual([booked])
  })
})

describe('recherche dans la zone de la carte', () => {
  // Autour d'Antananarivo, et Toamasina hors du cadre.
  const tana = { latitude: -18.9137, longitude: 47.5361 }
  const toamasina = { latitude: -18.1492, longitude: 49.4023 }
  const bounds = { south: -19.1, west: 47.3, north: -18.7, east: 47.7 }

  it('ne rend que les annonces situées dans le rectangle visible', async () => {
    const city = uniqueCity('carte')
    const inside = await publish(city, tana)
    await publish(city, toamasina)
    await publish(city)

    const result = await search({ city, bounds })
    expect(result.items.map((item) => item.listingId)).toEqual([inside])
  })

  it('compte une annonce posée sur le bord du rectangle', async () => {
    const city = uniqueCity('bord')
    const onEdge = await publish(city, { latitude: bounds.south, longitude: bounds.east })

    const result = await search({ city, bounds })
    expect(result.items.map((item) => item.listingId)).toEqual([onEdge])
  })

  it('combine la zone avec les autres filtres', async () => {
    const city = uniqueCity('zone-et-capacite')
    const large = await publish(city, { ...tana, capacity: 6 })
    await publish(city, { ...tana, capacity: 2 })
    await publish(city, { ...toamasina, capacity: 6 })

    const result = await search({ city, bounds, guests: 5 })
    expect(result.items.map((item) => item.listingId)).toEqual([large])
  })
})
