/**
 * Module 8 — Paiement et tarification, le devis.
 *
 * Contrat attendu, exporté par `src/academie/module-8.ts` :
 *
 *   export function createListing(input: {
 *     hostId: string; nightlyCents: number; currency: string
 *   }): Promise<string>
 *
 *   export function setHostRules(input: {
 *     listingId: string; minNights: number; maxNights: number; noticeDays: number
 *   }): Promise<void>
 *
 *   export function blockDates(input: {
 *     listingId: string; hostId: string
 *     from: string; to: string                          // intervalle semi-ouvert
 *   }): Promise<{ status: number }>                    // celle du module 7
 *
 *   export function setSeasonalRate(input: {
 *     listingId: string; from: string; to: string; nightlyCents: number
 *   }): Promise<void>
 *
 *   export function quoteStay(input: {
 *     listingId: string; checkIn: string; checkOut: string
 *     guests: number
 *     today: string                                     // horloge injectée
 *   }): Promise<
 *     | {
 *         lines: { code: string; label: string; amountCents: number }[]
 *         totalCents: number
 *         currency: string
 *         rateVersion: string
 *       }
 *     | { refused: string }
 *   >
 *
 * Codes de ligne imposés par la consigne :
 *   NIGHTS, CLEANING, SERVICE_FEE, WEEKLY_DISCOUNT (négatif), TOURIST_TAX.
 * Vous pouvez en ajouter; ceux-là doivent exister quand ils s'appliquent.
 *
 * `today` est passé par le harnais plutôt que lu dans l'horloge système : un
 * devis doit être reproductible, donc le temps est une entrée comme une autre.
 */
import { describe, expect, it } from 'vitest'
import {
  blockDates,
  createListing,
  quoteStay,
  setHostRules,
  setSeasonalRate,
} from '../../../src/academie/module-8'

const hostId = '55555555-5555-4555-8555-555555555555'
const today = '2026-06-01'

async function listing(rules?: { minNights?: number; maxNights?: number; noticeDays?: number }) {
  const listingId = await createListing({ hostId, nightlyCents: 20_000, currency: 'CAD' })
  await setHostRules({
    listingId,
    minNights: rules?.minNights ?? 1,
    maxNights: rules?.maxNights ?? 30,
    noticeDays: rules?.noticeDays ?? 0,
  })
  return listingId
}

async function quoted(listingId: string, checkIn: string, checkOut: string, guests = 2) {
  const quote = await quoteStay({ listingId, checkIn, checkOut, guests, today })
  if ('refused' in quote) throw new Error(`devis refusé : ${quote.refused}`)
  return quote
}

function lineOf(
  quote: { lines: { code: string; amountCents: number }[] },
  code: string,
) {
  return quote.lines.find((line) => line.code === code)
}

describe('décomposition du devis', () => {
  // Le critère central du module : un total qu'on ne peut pas justifier ligne
  // par ligne est un total qu'on ne peut pas défendre auprès d'un voyageur.
  it('fait correspondre exactement la somme des lignes et le total', async () => {
    const listingId = await listing()
    const quote = await quoted(listingId, '2026-07-10', '2026-07-13')

    const sum = quote.lines.reduce((total, line) => total + line.amountCents, 0)
    expect(sum).toBe(quote.totalCents)
  })

  it('n’utilise que des entiers, jamais de virgule flottante', async () => {
    const listingId = await listing()
    const quote = await quoted(listingId, '2026-07-10', '2026-07-13')

    expect(Number.isInteger(quote.totalCents)).toBe(true)
    for (const line of quote.lines) {
      expect(Number.isInteger(line.amountCents), `ligne ${line.code} non entière`).toBe(true)
    }
  })

  it('facture les nuits, pas les jours', async () => {
    const listingId = await listing()
    const quote = await quoted(listingId, '2026-07-10', '2026-07-13')

    expect(lineOf(quote, 'NIGHTS')?.amountCents).toBe(3 * 20_000)
  })

  it('porte les frais de ménage, de service et la taxe de séjour', async () => {
    const listingId = await listing()
    const quote = await quoted(listingId, '2026-07-10', '2026-07-13')

    for (const code of ['CLEANING', 'SERVICE_FEE', 'TOURIST_TAX']) {
      expect(lineOf(quote, code), `ligne ${code} absente du devis`).toBeDefined()
    }
  })

  it('rattache le devis à une version de barème', async () => {
    const listingId = await listing()
    const quote = await quoted(listingId, '2026-07-10', '2026-07-13')

    expect(quote.rateVersion, 'le devis doit porter la version du barème').toBeTruthy()
  })

  it('rend le même total pour les mêmes entrées', async () => {
    const listingId = await listing()
    const first = await quoted(listingId, '2026-07-10', '2026-07-13')
    const second = await quoted(listingId, '2026-07-10', '2026-07-13')

    expect(second.totalCents).toBe(first.totalCents)
  })
})

describe('réductions et saisons', () => {
  it('applique une réduction négative à partir de sept nuits', async () => {
    const listingId = await listing()
    const quote = await quoted(listingId, '2026-07-10', '2026-07-20')

    const discount = lineOf(quote, 'WEEKLY_DISCOUNT')
    expect(discount, 'un séjour de dix nuits doit porter une réduction').toBeDefined()
    expect(discount?.amountCents).toBeLessThan(0)
  })

  it('ne réduit pas un séjour court', async () => {
    const listingId = await listing()
    const quote = await quoted(listingId, '2026-07-10', '2026-07-13')

    expect(lineOf(quote, 'WEEKLY_DISCOUNT')).toBeUndefined()
  })

  it('facture le tarif saisonnier sur les nuits concernées', async () => {
    const listingId = await listing()
    const base = await quoted(listingId, '2026-12-20', '2026-12-23')

    await setSeasonalRate({
      listingId,
      from: '2026-12-01',
      to: '2027-01-05',
      nightlyCents: 50_000,
    })
    const high = await quoted(listingId, '2026-12-20', '2026-12-23')

    expect(high.totalCents).toBeGreaterThan(base.totalCents)
    expect(lineOf(high, 'NIGHTS')?.amountCents).toBe(3 * 50_000)
  })
})

describe('règles de l’hôte', () => {
  async function refusalOf(
    listingId: string,
    checkIn: string,
    checkOut: string,
    when = today,
  ) {
    const quote = await quoteStay({ listingId, checkIn, checkOut, guests: 2, today: when })
    return 'refused' in quote ? quote.refused : null
  }

  it('refuse un séjour plus court que le minimum, avec un motif', async () => {
    const listingId = await listing({ minNights: 3 })
    const refusal = await refusalOf(listingId, '2026-07-10', '2026-07-12')

    expect(refusal, 'deux nuits sous un minimum de trois doit être refusé').toBeTruthy()
  })

  it('accepte un séjour qui atteint exactement le minimum', async () => {
    const listingId = await listing({ minNights: 3 })
    expect(await refusalOf(listingId, '2026-07-10', '2026-07-13')).toBeNull()
  })

  it('refuse un séjour plus long que le maximum', async () => {
    const listingId = await listing({ maxNights: 5 })
    expect(await refusalOf(listingId, '2026-07-10', '2026-07-20')).toBeTruthy()
  })

  it('refuse une arrivée qui ne respecte pas le délai de préavis', async () => {
    const listingId = await listing({ noticeDays: 7 })
    expect(await refusalOf(listingId, '2026-06-03', '2026-06-06')).toBeTruthy()
  })

  it('refuse un séjour qui touche une date bloquée', async () => {
    const listingId = await listing()
    await blockDates({ listingId, hostId, from: '2026-08-10', to: '2026-08-15' })

    expect(await refusalOf(listingId, '2026-08-12', '2026-08-14')).toBeTruthy()
    expect(await refusalOf(listingId, '2026-08-14', '2026-08-18')).toBeTruthy()
  })

  it('laisse disponible le jour où le blocage se termine', async () => {
    const listingId = await listing()
    await blockDates({ listingId, hostId, from: '2026-08-10', to: '2026-08-15' })

    expect(await refusalOf(listingId, '2026-08-15', '2026-08-18')).toBeNull()
  })
})
