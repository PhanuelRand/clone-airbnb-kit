/**
 * Module 2 — Comptes, rôles et vérification de l'hôte.
 *
 * Contrat attendu, exporté par `src/academie/module-2.ts` :
 *
 *   export class Host {
 *     static register(input: { email: string; name: string }): Host
 *     readonly verification: 'PENDING' | 'APPROVED' | 'REJECTED'
 *     readonly rejectionReason: string | null
 *     approve(): void
 *     reject(reason: string): void
 *     canPublish(): boolean
 *   }
 *
 *   export function hashPassword(plain: string): Promise<string>
 *   export function verifyPassword(plain: string, hash: string): Promise<boolean>
 *
 *   export type Role = 'ANONYMOUS' | 'GUEST' | 'HOST'
 *   export type Action = 'PUBLISH_LISTING' | 'EDIT_LISTING' | 'REQUEST_BOOKING'
 *
 *   export function authorize(input: {
 *     role: Role
 *     hostVerification?: 'PENDING' | 'APPROVED' | 'REJECTED'
 *     action: Action
 *   }): { allowed: boolean; status: number }
 *
 * `authorize` est la décision d'autorisation de votre serveur, isolée pour être
 * testable. Vos routes doivent l'appeler : masquer un bouton dans l'interface
 * n'est pas une autorisation.
 */
import { describe, expect, it } from 'vitest'
import { Host, authorize, hashPassword, verifyPassword } from '../../../src/academie/module-2'

function registered() {
  return Host.register({ email: 'hery@example.org', name: 'Hery' })
}

describe('vérification de l’hôte', () => {
  it('interdit de publier tant que la vérification est en attente', () => {
    const host = registered()
    expect(host.verification).toBe('PENDING')
    expect(host.canPublish()).toBe(false)
  })

  it('autorise la publication une fois approuvé', () => {
    const host = registered()
    host.approve()
    expect(host.verification).toBe('APPROVED')
    expect(host.canPublish()).toBe(true)
  })

  it('garde un hôte refusé hors publication, avec un motif lisible', () => {
    const host = registered()
    host.reject('Titre de propriété illisible')
    expect(host.canPublish()).toBe(false)
    expect(host.rejectionReason).toContain('Titre')
  })
})

describe('stockage des mots de passe', () => {
  it('ne conserve jamais le mot de passe en clair', async () => {
    const hash = await hashPassword('mot-de-passe-de-test-1')
    expect(hash).not.toContain('mot-de-passe-de-test-1')
    expect(hash.length).toBeGreaterThan(20)
  })

  // Un hachage sans sel se casse avec une table pré-calculée.
  it('sale le hachage : deux hachages du même mot de passe diffèrent', async () => {
    const [first, second] = await Promise.all([
      hashPassword('mot-de-passe-de-test-1'),
      hashPassword('mot-de-passe-de-test-1'),
    ])
    expect(first).not.toBe(second)
  })

  it('reconnaît le bon mot de passe et rejette le mauvais', async () => {
    const hash = await hashPassword('mot-de-passe-de-test-1')
    expect(await verifyPassword('mot-de-passe-de-test-1', hash)).toBe(true)
    expect(await verifyPassword('mot-de-passe-de-test-2', hash)).toBe(false)
  })
})

describe('autorisation côté serveur', () => {
  it('refuse un visiteur anonyme avec 401', () => {
    const decision = authorize({ role: 'ANONYMOUS', action: 'REQUEST_BOOKING' })
    expect(decision.allowed).toBe(false)
    expect(decision.status).toBe(401)
  })

  it('refuse à un voyageur les routes d’hôte avec 403', () => {
    for (const action of ['PUBLISH_LISTING', 'EDIT_LISTING'] as const) {
      const decision = authorize({ role: 'GUEST', action })
      expect(decision.allowed, `un voyageur ne doit pas pouvoir ${action}`).toBe(false)
      expect(decision.status).toBe(403)
    }
  })

  it('autorise un voyageur à demander une réservation', () => {
    const decision = authorize({ role: 'GUEST', action: 'REQUEST_BOOKING' })
    expect(decision.allowed).toBe(true)
  })

  // Le cœur du module : être authentifié comme hôte ne suffit pas à publier.
  it('refuse la publication à un hôte non vérifié, même authentifié', () => {
    for (const verification of ['PENDING', 'REJECTED'] as const) {
      const decision = authorize({
        role: 'HOST',
        hostVerification: verification,
        action: 'PUBLISH_LISTING',
      })
      expect(decision.allowed, `un hôte ${verification} ne doit pas publier`).toBe(false)
      expect(decision.status).toBe(403)
    }
  })

  it('autorise la publication à un hôte approuvé', () => {
    const decision = authorize({
      role: 'HOST',
      hostVerification: 'APPROVED',
      action: 'PUBLISH_LISTING',
    })
    expect(decision.allowed).toBe(true)
  })
})
