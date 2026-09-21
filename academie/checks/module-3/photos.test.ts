/**
 * Module 3 — Annonces et photos.
 *
 * Contrat attendu, exporté par `src/academie/module-3.ts` :
 *
 *   export function createListing(input: {
 *     hostId: string; title: string
 *   }): Promise<string>                        // rend l'identifiant de l'annonce
 *
 *   export function createUploadUrl(input: {
 *     listingId: string; contentType: string; sizeBytes: number
 *   }): Promise<
 *     | { url: string; key: string; expiresAt: string }   // ISO 8601
 *     | { refused: string }                               // motif lisible
 *   >
 *
 *   export function attachPhoto(input: {
 *     listingId: string; key: string
 *   }): Promise<{ attached: boolean; reason?: string }>
 *
 *   export function listPhotos(listingId: string): Promise<
 *     { key: string; position: number; isCover: boolean }[]
 *   >
 *
 *   export function setCoverPhoto(input: {
 *     listingId: string; key: string
 *   }): Promise<void>
 *
 *   export function canPublishListing(listingId: string): Promise<{
 *     allowed: boolean; reason?: string
 *   }>
 *
 * Règles imposées par la consigne, que cette suite vérifie :
 *   - seuls `image/jpeg`, `image/png` et `image/webp` sont acceptés;
 *   - un fichier de plus de 10 000 000 octets est refusé;
 *   - l'URL de téléversement expire dans l'heure;
 *   - une annonce sans photo ne peut pas être publiée;
 *   - une annonce avec photos a exactement une photo de couverture.
 */
import { describe, expect, it } from 'vitest'
import {
  attachPhoto,
  canPublishListing,
  createListing,
  createUploadUrl,
  listPhotos,
  setCoverPhoto,
} from '../../../src/academie/module-3'

const hostId = '33333333-3333-4333-8333-333333333333'
const maxBytes = 10_000_000

async function listingWithPhotos(count: number) {
  const listingId = await createListing({ hostId, title: 'Villa à Nosy Be' })

  for (let index = 0; index < count; index += 1) {
    const grant = await createUploadUrl({
      listingId,
      contentType: 'image/jpeg',
      sizeBytes: 250_000,
    })
    if (!('key' in grant)) throw new Error(`téléversement refusé : ${grant.refused}`)
    await attachPhoto({ listingId, key: grant.key })
  }

  return listingId
}

describe('autorisation de téléversement', () => {
  it('accorde une URL signée pour une image', async () => {
    const listingId = await createListing({ hostId, title: 'Bungalow à Ifaty' })
    const grant = await createUploadUrl({
      listingId,
      contentType: 'image/jpeg',
      sizeBytes: 250_000,
    })

    expect('key' in grant, 'une image valide doit être acceptée').toBe(true)
    if (!('key' in grant)) return
    expect(grant.url).toMatch(/^https?:\/\/.+/)
  })

  it('fait expirer l’URL dans l’heure', async () => {
    const listingId = await createListing({ hostId, title: 'Bungalow à Ifaty' })
    const grant = await createUploadUrl({
      listingId,
      contentType: 'image/png',
      sizeBytes: 100_000,
    })
    if (!('key' in grant)) throw new Error('téléversement refusé')

    const expiresAt = new Date(grant.expiresAt).getTime()
    expect(Number.isNaN(expiresAt), 'expiresAt doit être une date ISO 8601').toBe(false)
    expect(expiresAt).toBeGreaterThan(Date.now())
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 3_600_000)
  })

  // Le type est décidé côté serveur : un client peut annoncer ce qu'il veut.
  it('refuse un type de fichier qui n’est pas une image', async () => {
    const listingId = await createListing({ hostId, title: 'Bungalow à Ifaty' })

    for (const contentType of ['application/pdf', 'text/html', 'application/octet-stream']) {
      const grant = await createUploadUrl({ listingId, contentType, sizeBytes: 100_000 })
      expect('refused' in grant, `${contentType} doit être refusé`).toBe(true)
    }
  })

  it('refuse un fichier trop volumineux', async () => {
    const listingId = await createListing({ hostId, title: 'Bungalow à Ifaty' })
    const grant = await createUploadUrl({
      listingId,
      contentType: 'image/jpeg',
      sizeBytes: maxBytes + 1,
    })

    expect('refused' in grant, 'un fichier de plus de 10 Mo doit être refusé').toBe(true)
  })
})

describe('photos d’une annonce', () => {
  it('conserve les photos attachées, à des positions distinctes', async () => {
    const listingId = await listingWithPhotos(3)
    const photos = await listPhotos(listingId)

    expect(photos).toHaveLength(3)
    expect(new Set(photos.map((photo) => photo.position)).size).toBe(3)
  })

  it('désigne exactement une photo de couverture', async () => {
    const listingId = await listingWithPhotos(3)
    const photos = await listPhotos(listingId)

    expect(photos.filter((photo) => photo.isCover)).toHaveLength(1)
  })

  it('déplace la couverture sans en créer une seconde', async () => {
    const listingId = await listingWithPhotos(3)
    const before = await listPhotos(listingId)
    const target = before.find((photo) => !photo.isCover)
    expect(target, 'il faut au moins une photo hors couverture').toBeDefined()
    if (!target) return

    await setCoverPhoto({ listingId, key: target.key })
    const after = await listPhotos(listingId)

    expect(after.filter((photo) => photo.isCover)).toHaveLength(1)
    expect(after.find((photo) => photo.isCover)?.key).toBe(target.key)
  })

  it('refuse d’attacher une photo à une annonce qui n’est pas la sienne', async () => {
    const first = await listingWithPhotos(1)
    const second = await createListing({ hostId, title: 'Autre annonce' })
    const photos = await listPhotos(first)
    const borrowed = photos[0]
    expect(borrowed).toBeDefined()
    if (!borrowed) return

    const result = await attachPhoto({ listingId: second, key: borrowed.key })
    expect(result.attached, 'une clé déjà rattachée ne doit pas être reprise').toBe(false)
  })
})

describe('publication d’une annonce', () => {
  it('refuse la publication d’une annonce sans photo, avec un motif', async () => {
    const listingId = await createListing({ hostId, title: 'Annonce vide' })
    const decision = await canPublishListing(listingId)

    expect(decision.allowed).toBe(false)
    expect(decision.reason, 'le refus doit porter un motif lisible').toBeTruthy()
  })

  it('autorise la publication dès qu’une photo est attachée', async () => {
    const listingId = await listingWithPhotos(1)
    expect((await canPublishListing(listingId)).allowed).toBe(true)
  })
})
