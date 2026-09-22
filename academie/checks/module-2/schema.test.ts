/**
 * Module 2 — Architecture, le schéma.
 *
 * Elles lisent votre dépôt sans exécuter de code : présence d'une migration
 * versionnée, contraintes déclarées, montants en entiers. Ce sont les critères
 * c1 et c4 de la consigne.
 *
 * Contrat attendu, exporté par `src/academie/module-2.ts` :
 *
 *   export const schema: {
 *     migrationsDir: string          // ex. 'migrations', relatif à la racine
 *     tables: {
 *       host: string                 // le nom RÉEL de vos tables,
 *       guest: string                // quel qu'il soit
 *       listing: string
 *       booking: string
 *     }
 *     moneyColumns: string[]         // ex. ['reservations.montant_total']
 *   }
 *
 * Vous nommez vos tables et vos colonnes comme vous voulez : la suite lit ce
 * que vous déclarez ici. Elle vérifie que ces objets existent vraiment dans vos
 * migrations et qu'ils portent les bonnes contraintes.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { schema } from '../../../src/academie/module-2'

function migrationsSql(): string {
  const dir = join(process.cwd(), schema.migrationsDir)
  expect(existsSync(dir), `dossier de migrations introuvable : ${schema.migrationsDir}`).toBe(
    true,
  )

  const files = readdirSync(dir).filter((name) => name.endsWith('.sql'))
  expect(files.length, `aucune migration .sql dans ${schema.migrationsDir}/`).toBeGreaterThan(
    0,
  )

  return files
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n')
    .toLowerCase()
}

describe('migration initiale', () => {
  it('déclare les quatre tables du domaine', () => {
    const sql = migrationsSql()
    for (const [role, table] of Object.entries(schema.tables)) {
      expect(
        sql,
        `table « ${table} » (${role}) absente des migrations`,
      ).toMatch(new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?[\\w."]*${table}\\b`))
    }
  })

  it('déclare des clés primaires et des clés étrangères', () => {
    const sql = migrationsSql()
    expect(sql).toContain('primary key')
    expect(sql).toMatch(/references|foreign key/)
  })

  it('déclare des colonnes obligatoires', () => {
    expect(migrationsSql()).toContain('not null')
  })

  it('déclare au moins une colonne de montant', () => {
    expect(
      schema.moneyColumns.length,
      'déclarez vos colonnes de montant dans schema.moneyColumns',
    ).toBeGreaterThan(0)
  })

  it('stocke les montants en entiers, jamais en virgule flottante', () => {
    const sql = migrationsSql()

    for (const reference of schema.moneyColumns) {
      const column = (reference.split('.').pop() ?? '').toLowerCase()
      expect(column.length, `référence de colonne invalide : ${reference}`).toBeGreaterThan(0)

      const declaration = new RegExp(`\\b${column}\\s+(\\w+)`).exec(sql)
      expect(declaration?.[1], `colonne « ${reference} » introuvable dans les migrations`).toBeDefined()
      expect(
        ['integer', 'int', 'int4', 'bigint', 'int8'],
        `la colonne « ${reference} » doit être un entier, pas ${declaration?.[1]}`,
      ).toContain(declaration?.[1])
    }
  })
})
