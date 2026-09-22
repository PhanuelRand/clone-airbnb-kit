/**
 * Module 13 — Messagerie, en temps réel. Module Platine.
 *
 * Le voyageur et l'hôte d'une réservation se parlent. Deux règles font la
 * différence entre une messagerie et une fuite de données :
 *
 * - seuls les deux participants lisent la conversation, et le serveur le
 *   vérifie à chaque lecture comme à chaque abonnement;
 * - tant que la réservation n'est pas confirmée, une adresse électronique ou un
 *   numéro de téléphone écrits dans un message sont masqués. Sans cette règle,
 *   voyageur et hôte s'arrangent en dehors de la plateforme, et la plateforme
 *   ne protège plus ni l'un ni l'autre.
 *
 * Contrat attendu, exporté par `src/academie/module-13.ts` :
 *
 *   export function openConversation(input: {
 *     guestId: string; hostId: string
 *   }): Promise<string>                          // l'identifiant de conversation
 *
 *   export function confirmBooking(conversationId: string): Promise<void>
 *
 *   export function sendMessage(input: {
 *     conversationId: string; senderId: string; body: string
 *   }): Promise<{ status: number }>              // 201, 400 ou 403
 *
 *   export function readConversation(input: {
 *     conversationId: string; readerId: string
 *   }): Promise<{ status: number; messages: { senderId: string; body: string }[] }>
 *
 *   export function subscribe(input: {
 *     conversationId: string; readerId: string
 *     onMessage: (message: { senderId: string; body: string }) => void
 *   }): Promise<{ status: number; unsubscribe: () => void }>
 *
 * Un tiers reçoit 403 et aucun message. Un message vide reçoit 400. Le masquage
 * s'applique à la lecture comme à la diffusion en temps réel.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  confirmBooking,
  openConversation,
  readConversation,
  sendMessage,
  subscribe,
} from '../../../src/academie/module-13'

const guestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const hostId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const strangerId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function open() {
  return openConversation({ guestId, hostId })
}

/** Attend un message diffusé, ou échoue au bout de trois secondes. */
function nextMessage(conversationId: string, readerId: string) {
  return new Promise<{ senderId: string; body: string }>((resolveMessage, reject) => {
    const timer = setTimeout(() => reject(new Error('aucun message reçu en 3 s')), 3_000)
    void subscribe({
      conversationId,
      readerId,
      onMessage: (message) => {
        clearTimeout(timer)
        resolveMessage(message)
      },
    }).then((subscription) => cleanups.push(subscription.unsubscribe))
  })
}

describe('entre les deux participants', () => {
  it('rend les messages aux deux participants, dans l’ordre d’envoi', async () => {
    const conversationId = await open()
    expect((await sendMessage({ conversationId, senderId: guestId, body: 'Bonjour' })).status).toBe(
      201,
    )
    await sendMessage({ conversationId, senderId: hostId, body: 'Bienvenue' })

    for (const readerId of [guestId, hostId]) {
      const result = await readConversation({ conversationId, readerId })
      expect(result.status).toBe(200)
      expect(result.messages.map((message) => message.body)).toEqual(['Bonjour', 'Bienvenue'])
    }
  })

  it('refuse un message vide avec 400', async () => {
    const conversationId = await open()
    const result = await sendMessage({ conversationId, senderId: guestId, body: '   ' })
    expect(result.status).toBe(400)
  })
})

describe('fermée aux tiers', () => {
  it('refuse la lecture à un tiers avec 403, sans rien lui rendre', async () => {
    const conversationId = await open()
    await sendMessage({ conversationId, senderId: guestId, body: 'Message privé' })

    const result = await readConversation({ conversationId, readerId: strangerId })
    expect(result.status).toBe(403)
    expect(result.messages).toEqual([])
  })

  it('refuse l’envoi à un tiers avec 403', async () => {
    const conversationId = await open()
    const result = await sendMessage({ conversationId, senderId: strangerId, body: 'Intrus' })
    expect(result.status).toBe(403)
    expect((await readConversation({ conversationId, readerId: guestId })).messages).toEqual([])
  })

  it('refuse l’abonnement en temps réel à un tiers', async () => {
    const conversationId = await open()
    const subscription = await subscribe({
      conversationId,
      readerId: strangerId,
      onMessage: () => undefined,
    })
    cleanups.push(subscription.unsubscribe)
    expect(subscription.status).toBe(403)
  })
})

describe('en temps réel', () => {
  it('diffuse un message à l’autre participant dès son envoi', async () => {
    const conversationId = await open()
    const received = nextMessage(conversationId, hostId)
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))

    await sendMessage({ conversationId, senderId: guestId, body: 'J’arrive à 15 h' })
    expect((await received).body).toBe('J’arrive à 15 h')
  })
})

describe('coordonnées masquées avant confirmation', () => {
  const email = 'hery.rakoto@example.org'
  const phones = ['+261 34 12 345 67', '034 12 345 67', '0341234567']

  it('masque une adresse électronique tant que la réservation n’est pas confirmée', async () => {
    const conversationId = await open()
    await sendMessage({ conversationId, senderId: guestId, body: `Écrivez-moi à ${email}` })

    const [message] = (await readConversation({ conversationId, readerId: hostId })).messages
    expect(message?.body, 'le message reste lisible').toContain('Écrivez-moi')
    expect(message?.body, 'mais pas l’adresse').not.toContain(email)
  })

  it('masque un numéro de téléphone, quelle que soit son écriture', async () => {
    const conversationId = await open()
    for (const phone of phones) {
      await sendMessage({ conversationId, senderId: hostId, body: `Appelez le ${phone}` })
    }

    const { messages } = await readConversation({ conversationId, readerId: guestId })
    for (const message of messages) {
      const digits = message.body.replace(/\D/g, '')
      expect(digits, `numéro visible dans « ${message.body} »`).not.toMatch(/\d{7,}/)
    }
  })

  it('masque aussi les coordonnées diffusées en temps réel', async () => {
    const conversationId = await open()
    const received = nextMessage(conversationId, hostId)
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))

    await sendMessage({ conversationId, senderId: guestId, body: `Contact : ${email}` })
    expect((await received).body).not.toContain(email)
  })

  it('laisse passer les coordonnées une fois la réservation confirmée', async () => {
    const conversationId = await open()
    await confirmBooking(conversationId)
    await sendMessage({ conversationId, senderId: guestId, body: `Écrivez-moi à ${email}` })

    const [message] = (await readConversation({ conversationId, readerId: hostId })).messages
    expect(message?.body).toContain(email)
  })
})
