/**
 * Module 8 — Mise en production.
 *
 * Cette suite n'interroge pas votre code source : elle interroge **votre
 * application déployée**, à son URL publique. C'est la preuve qu'elle
 * fonctionne vraiment, hors de votre machine.
 *
 * Renseignez le secret `DEPLOYMENT_URL` dans les paramètres de votre dépôt
 * GitHub (Settings → Secrets and variables → Actions) avec l'adresse de votre
 * application — par exemple `https://mon-clone-airbnb.fly.dev`.
 *
 * Contrat HTTP exigé par la consigne. Ce sont les seules routes que la suite
 * connaît; le reste de votre API vous appartient.
 *
 *   GET  /health                 -> 2xx
 *
 *   POST /hosts                  -> 200 ou 201, corps { id }
 *        { email, name }
 *
 *   POST /listings               -> 200 ou 201, corps { id }
 *        { hostId, city, title, nightlyCents, capacity }
 *
 *   GET  /search?city=…          -> 200, corps { items: [{ listingId }] }
 *
 *   POST /bookings               -> 200 ou 201, corps { id }
 *        { listingId, checkIn, checkOut, guests }
 *
 *   Toute requête mal formée sur ces routes -> 4xx, jamais 5xx.
 */
import { describe, expect, it } from 'vitest'

const baseUrl = (process.env.DEPLOYMENT_URL ?? '').replace(/\/$/, '')
const timeout = 20_000

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    // Un déploiement endormi doit se réveiller, mais pas bloquer la suite.
    signal: AbortSignal.timeout(timeout),
  })
}

async function identifierOf(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { id?: string }
  return body.id
}

describe('application déployée', () => {
  it('a une URL de déploiement configurée', () => {
    expect(
      baseUrl,
      'Renseignez le secret DEPLOYMENT_URL avec l’URL publique de votre application.',
    ).toMatch(/^https?:\/\/.+/)
  })

  it('sert son API en HTTPS', () => {
    expect(baseUrl.startsWith('https://'), 'le déploiement doit être servi en HTTPS').toBe(
      true,
    )
  })

  it('répond sur son point de santé', { timeout }, async () => {
    const response = await call('/health')
    expect(response.ok).toBe(true)
  })
})

describe('parcours complet contre le déploiement', () => {
  it('accepte la création d’un hôte', { timeout }, async () => {
    const response = await call('/hosts', {
      method: 'POST',
      body: JSON.stringify({
        email: `hote-${Date.now()}@example.org`,
        name: 'Hôte de vérification',
      }),
    })

    expect([200, 201]).toContain(response.status)
    expect(await identifierOf(response), 'la réponse doit porter l’identifiant').toBeTruthy()
  })

  it('publie une annonce et la retrouve par la recherche', { timeout }, async () => {
    const city = `verification-${Date.now()}`

    const host = await call('/hosts', {
      method: 'POST',
      body: JSON.stringify({
        email: `hote-${Date.now()}@example.org`,
        name: 'Hôte de vérification',
      }),
    })
    const hostId = await identifierOf(host)

    const listing = await call('/listings', {
      method: 'POST',
      body: JSON.stringify({
        hostId,
        city,
        title: 'Annonce de vérification',
        nightlyCents: 20_000,
        capacity: 2,
      }),
    })
    expect([200, 201]).toContain(listing.status)
    const listingId = await identifierOf(listing)
    expect(listingId).toBeTruthy()

    const search = await call(`/search?city=${encodeURIComponent(city)}`)
    expect(search.status).toBe(200)

    const body = (await search.json()) as { items?: { listingId?: string }[] }
    expect(
      body.items?.some((item) => item.listingId === listingId),
      'l’annonce publiée doit apparaître dans la recherche',
    ).toBe(true)
  })

  it('accepte une réservation et rend son identifiant', { timeout }, async () => {
    const city = `verification-${Date.now()}`

    const host = await call('/hosts', {
      method: 'POST',
      body: JSON.stringify({
        email: `hote-${Date.now()}@example.org`,
        name: 'Hôte de vérification',
      }),
    })
    const listing = await call('/listings', {
      method: 'POST',
      body: JSON.stringify({
        hostId: await identifierOf(host),
        city,
        title: 'Annonce de vérification',
        nightlyCents: 20_000,
        capacity: 2,
      }),
    })

    const response = await call('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        listingId: await identifierOf(listing),
        checkIn: '2027-02-10',
        checkOut: '2027-02-14',
        guests: 2,
      }),
    })

    expect([200, 201]).toContain(response.status)
    expect(await identifierOf(response), 'la réponse doit porter l’identifiant').toBeTruthy()
  })

  it('refuse une réservation mal formée', { timeout }, async () => {
    const response = await call('/bookings', {
      method: 'POST',
      body: JSON.stringify({ listingId: 'inexistant', checkIn: 'bientôt' }),
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it('refuse un séjour dont le départ précède l’arrivée', { timeout }, async () => {
    const response = await call('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        listingId: '00000000-0000-4000-8000-000000000000',
        checkIn: '2027-02-14',
        checkOut: '2027-02-10',
        guests: 2,
      }),
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })
})
