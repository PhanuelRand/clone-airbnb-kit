/**
 * Module 13 : Annulation et remboursement.
 *
 * Contrat attendu, exporté par `src/academie/module-13.ts` :
 *
 *   export function refundFor(input: {
 *     policy: 'FLEXIBLE' | 'MODERATE' | 'STRICT'
 *     total: number
 *     checkIn: string          // 'AAAA-MM-JJ'
 *     cancelledAt: string      // 'AAAA-MM-JJ'
 *   }): { refund: number }
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
 * l'hôte : le cours du module les compare avant de trancher.
 */
import { describe, expect, it } from 'vitest'
import { refundFor } from '../../../src/academie/module-13'

describe('barème de remboursement', () => {
  const total = 40_001

  const cases: {
    policy: 'FLEXIBLE' | 'MODERATE' | 'STRICT'
    cancelledAt: string
    expected: number
  }[] = [
    { policy: 'FLEXIBLE', cancelledAt: '2030-09-01', expected: total },
    { policy: 'FLEXIBLE', cancelledAt: '2030-09-09', expected: total },
    { policy: 'FLEXIBLE', cancelledAt: '2030-09-10', expected: 0 },
    { policy: 'MODERATE', cancelledAt: '2030-09-01', expected: total },
    { policy: 'MODERATE', cancelledAt: '2030-09-05', expected: total },
    { policy: 'MODERATE', cancelledAt: '2030-09-07', expected: Math.floor(total / 2) },
    { policy: 'MODERATE', cancelledAt: '2030-09-10', expected: 0 },
    { policy: 'STRICT', cancelledAt: '2030-09-01', expected: Math.floor(total / 2) },
    { policy: 'STRICT', cancelledAt: '2030-09-03', expected: Math.floor(total / 2) },
    { policy: 'STRICT', cancelledAt: '2030-09-05', expected: 0 },
  ]

  for (const scenario of cases) {
    it(`${scenario.policy}, annulée le ${scenario.cancelledAt}`, () => {
      const result = refundFor({
        policy: scenario.policy,
        total: total,
        checkIn: '2030-09-10',
        cancelledAt: scenario.cancelledAt,
      })

      expect(result.refund).toBe(scenario.expected)
    })
  }

  it('ne rembourse jamais plus que le total, ni un montant négatif', () => {
    for (const policy of ['FLEXIBLE', 'MODERATE', 'STRICT'] as const) {
      for (const cancelledAt of ['2030-08-01', '2030-09-09', '2030-09-11']) {
        const { refund } = refundFor({
          policy,
          total: total,
          checkIn: '2030-09-10',
          cancelledAt,
        })

        expect(Number.isInteger(refund)).toBe(true)
        expect(refund).toBeGreaterThanOrEqual(0)
        expect(refund).toBeLessThanOrEqual(total)
      }
    }
  })
})
