// Approuve ou refuse un hôte, après avoir vérifié qui il est (module 6).
//
// Usage :
//   node --env-file=.env scripts/approuver-hote.mjs courriel@example.org
//   node --env-file=.env scripts/approuver-hote.mjs courriel@example.org "motif du refus"
//
// En production, donnez l'adresse de la base de production pour cette seule
// commande, comme pour `npm run migrate` au module 15.
//
// Ce fichier vous appartient. Remplacez les noms ci-dessous par ceux de vos
// tables et de vos colonnes : le script ne les devine pas.

import pg from 'pg'

const TABLE_DES_COMPTES = 'comptes'
const COLONNE_COURRIEL = 'courriel'
const COLONNE_ROLES = 'roles' // une liste qui contient 'HOST' pour un hôte
const COLONNE_VERIFICATION = 'verification_hote' // 'PENDING', 'APPROVED' ou 'REJECTED'
const COLONNE_MOTIF = 'motif_refus'

const [courriel, motif] = process.argv.slice(2)
if (!courriel) {
  console.error('Indiquez le courriel du compte, puis un motif si vous refusez.')
  process.exit(2)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL est vide. Lancez le script avec --env-file=.env.')
  process.exit(2)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  const { rowCount } = await client.query(
    `update ${TABLE_DES_COMPTES}
        set ${COLONNE_VERIFICATION} = $2, ${COLONNE_MOTIF} = $3
      where lower(${COLONNE_COURRIEL}) = lower($1) and 'HOST' = any(${COLONNE_ROLES})`,
    [courriel, motif ? 'REJECTED' : 'APPROVED', motif ?? null],
  )
  if (rowCount === 0) console.log('Aucun hôte avec ce courriel. Le compte a-t-il demandé à devenir hôte ?')
  else console.log(motif ? `Hôte refusé : ${motif}` : 'Hôte approuvé : il peut publier.')
} finally {
  await client.end()
}
