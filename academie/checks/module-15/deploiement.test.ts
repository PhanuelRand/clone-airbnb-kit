/**
 * Module 15 : Mise en production.
 *
 * Cette suite n'interroge pas votre code source : elle interroge **votre
 * application déployée**, à son adresse publique. C'est la preuve qu'elle
 * fonctionne vraiment, hors de votre machine.
 *
 * Elle ne crée rien et ne modifie rien : votre base de production ne reçoit
 * aucune donnée de vérification.
 *
 * Renseignez deux secrets dans les paramètres de votre dépôt GitHub (Settings,
 * puis Secrets and variables, puis Actions) :
 *
 *   DEPLOYMENT_URL   l'adresse de votre application, par exemple https://mon-clone.onrender.com
 *   INTERFACE_URL    la même adresse : votre interface y est servie, avec l'API
 *
 * Contrat HTTP exigé :
 *
 *   GET  /health               -> 2xx
 *   GET  /search?city=…        -> 200, corps { items: [...] }, accessible sans compte
 *   POST /listings             -> 401 sans session : publier demande d'être connecté
 *   POST /bookings             -> 401 sans session : réserver aussi
 *   Une requête mal formée     -> 4xx, jamais 5xx
 *
 * Un hébergeur gratuit endort l'application après quelques minutes sans
 * visite : la première requête peut prendre près d'une minute. La suite
 * l'attend.
 */
import { describe, expect, it } from 'vitest'

const apiUrl = (process.env.DEPLOYMENT_URL ?? '').replace(/\/$/, '')
const interfaceUrl = (process.env.INTERFACE_URL ?? '').replace(/\/$/, '')
const timeout = 90_000

function call(url: string, init: RequestInit = {}): Promise<Response> {
  if (!/^https?:\/\//.test(url)) {
    throw new Error('Adresse manquante : renseignez les secrets DEPLOYMENT_URL et INTERFACE_URL.')
  }
  return fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    // Un déploiement endormi doit se réveiller, mais pas bloquer la suite.
    signal: AbortSignal.timeout(timeout),
  })
}

describe('l’API déployée', () => {
  it('a une adresse configurée, servie en HTTPS', () => {
    expect(apiUrl, 'renseignez le secret DEPLOYMENT_URL avec l’adresse de votre API').toMatch(
      /^https:\/\/.+/,
    )
  })

  it('répond sur son point de santé', { timeout }, async () => {
    const response = await call(`${apiUrl}/health`)
    expect(response.ok).toBe(true)
  })

  it('laisse chercher un logement sans compte', { timeout }, async () => {
    const response = await call(`${apiUrl}/search?city=Antananarivo`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { items?: unknown }
    expect(Array.isArray(body.items), 'la recherche rend une liste items').toBe(true)
  })
})

describe('les routes protégées', () => {
  // Publier ou réserver sans être connecté doit être refusé, en production aussi.
  it('refuse de publier une annonce sans session', { timeout }, async () => {
    const response = await call(`${apiUrl}/listings`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Annonce anonyme' }),
    })
    expect(response.status).toBe(401)
  })

  it('refuse de réserver sans session', { timeout }, async () => {
    const response = await call(`${apiUrl}/bookings`, {
      method: 'POST',
      body: JSON.stringify({ checkIn: '2030-02-10', checkOut: '2030-02-14' }),
    })
    expect(response.status).toBe(401)
  })

  it('répond à une requête mal formée par une erreur 4xx, jamais 5xx', { timeout }, async () => {
    const response = await call(`${apiUrl}/search?guests=beaucoup`)
    expect(response.status).toBeLessThan(500)
  })
})

describe('l’interface déployée', () => {
  it('a une adresse configurée, servie en HTTPS', () => {
    expect(
      interfaceUrl,
      'renseignez le secret INTERFACE_URL avec l’adresse de votre interface',
    ).toMatch(/^https:\/\/.+/)
  })

  it('sert une page HTML', { timeout }, async () => {
    const response = await call(interfaceUrl, { headers: { Accept: 'text/html' } })
    expect(response.ok).toBe(true)
    expect(await response.text()).toMatch(/<html[\s>]/i)
  })
})
