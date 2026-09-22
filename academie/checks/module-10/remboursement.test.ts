/**
 * Module 10 — Annulation et remboursement.
 *
 * Contrat attendu, exporté par `src/academie/module-10.ts` :
 *
 *   export function refundFor(input: {
 *     policy: 'FLEXIBLE' | 'MODERATE' | 'STRICT'
 *     totalCents: number
 *     checkIn: string          // 'AAAA-MM-JJ'
 *     cancelledAt: string      // 'AAAA-MM-JJ'
 *   }): { refundCents: number }
 *
 * Barème imposé, où `joursAvant` est le nombre de jours entiers entre
 * l'annulation et l'arrivée :
 *
 *   FLEXIBLE   joursAvant >= 1  -> 100 %          sinon 0 %
 *   MODERATE   joursAvant >= 5  -> 100 %
 *              joursAvant >= 1  ->  50 %          sinon 0 %
 *   STRICT     joursAvant >= 7  ->  50 %          sinon 0 %
 *
 * Les pourcentages sont arrondis à l'entier inférieur. Une politique se
 * choisit en comparant ce qu'elle promet au voyageur et ce qu'elle coûte à
 * l'hôte : le cours du module compare les trois avant de trancher.
 */
import { describe, expect, it } from 'vitest'
import { refundFor } from '../../../src/academie/module-10'

describe('barème de remboursement', () => {
  const total = 40_001

  const cases: {
    policy: 'FLEXIBLE' | 'MODERATE' | 'STRICT'
    cancelledAt: string
    expected: number
  }[] = [
    { policy: 'FLEXIBLE', cancelledAt: '2026-09-01', expected: total },
    { policy: 'FLEXIBLE', cancelledAt: '2026-09-09', expected: total },
    { policy: 'FLEXIBLE', cancelledAt: '2026-09-10', expected: 0 },
    { policy: 'MODERATE', cancelledAt: '2026-09-01', expected: total },
    { policy: 'MODERATE', cancelledAt: '2026-09-05', expected: total },
    { policy: 'MODERATE', cancelledAt: '2026-09-07', expected: Math.floor(total / 2) },
    { policy: 'MODERATE', cancelledAt: '2026-09-10', expected: 0 },
    { policy: 'STRICT', cancelledAt: '2026-09-01', expected: Math.floor(total / 2) },
    { policy: 'STRICT', cancelledAt: '2026-09-03', expected: Math.floor(total / 2) },
    { policy: 'STRICT', cancelledAt: '2026-09-05', expected: 0 },
  ]

  for (const scenario of cases) {
    it(`${scenario.policy}, annulée le ${scenario.cancelledAt}`, () => {
      const result = refundFor({
        policy: scenario.policy,
        totalCents: total,
        checkIn: '2026-09-10',
        cancelledAt: scenario.cancelledAt,
      })

      expect(result.refundCents).toBe(scenario.expected)
    })
  }

  it('ne rembourse jamais plus que le total, ni un montant négatif', () => {
    for (const policy of ['FLEXIBLE', 'MODERATE', 'STRICT'] as const) {
      for (const cancelledAt of ['2026-08-01', '2026-09-09', '2026-09-11']) {
        const { refundCents } = refundFor({
          policy,
          totalCents: total,
          checkIn: '2026-09-10',
          cancelledAt,
        })

        expect(Number.isInteger(refundCents)).toBe(true)
        expect(refundCents).toBeGreaterThanOrEqual(0)
        expect(refundCents).toBeLessThanOrEqual(total)
      }
    }
  })
})
