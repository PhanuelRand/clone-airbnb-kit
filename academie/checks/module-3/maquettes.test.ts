/**
 * Module 3 — Design, les maquettes.
 *
 * Avant de construire les écrans, vous les dessinez. Une maquette se change en
 * quelques minutes; un écran construit, en quelques heures. Ce module vous
 * fait produire les cinq pages principales de l'application, en HTML, pour les
 * ouvrir dans un navigateur et les montrer avant d'écrire la moindre route.
 *
 * Cette suite vérifie que les cinq pages existent et que ce sont de vraies
 * pages. Elle ne juge pas leur qualité visuelle : c'est le rôle de la
 * relecture par un mentor.
 *
 * Contrat attendu, exporté par `src/academie/module-3.ts` :
 *
 *   export const maquettes = {
 *     accueil: string,       // la recherche et la liste des logements
 *     annonce: string,       // la fiche d'un logement
 *     reservation: string,   // le récapitulatif et le paiement
 *     hote: string,          // le tableau de bord de l'hôte
 *     connexion: string,     // la connexion et l'inscription
 *   }
 *
 * Chaque valeur est le chemin d'un fichier `.html` de votre dépôt, par exemple
 * 'maquettes/accueil.html'.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { maquettes } from '../../../src/academie/module-3'

const PAGES = ['accueil', 'annonce', 'reservation', 'hote', 'connexion'] as const

function read(page: (typeof PAGES)[number]) {
  const path = resolve(process.cwd(), maquettes[page])
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

/** Le texte que voit un visiteur : sans balises, sans styles, sans scripts. */
function visibleText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('les cinq pages', () => {
  it('sont déclarées, chacune dans son propre fichier', () => {
    expect(maquettes, 'exportez un objet nommé maquettes').toBeTypeOf('object')
    for (const page of PAGES) {
      expect(maquettes[page], `indiquez le fichier de la page ${page}`).toBeTypeOf('string')
    }
    const paths = PAGES.map((page) => resolve(process.cwd(), maquettes[page]))
    expect(new Set(paths).size, 'une page par fichier').toBe(PAGES.length)
  })

  for (const page of PAGES) {
    it(`contient la page ${page}, dans votre dépôt, en HTML`, () => {
      const path = resolve(process.cwd(), maquettes[page])
      const inside = relative(process.cwd(), path)
      expect(!inside.startsWith('..') && !isAbsolute(inside), 'restez dans votre dépôt').toBe(
        true,
      )
      expect(path, 'une maquette est un fichier .html').toMatch(/\.html$/i)
      expect(existsSync(path), `aucun fichier à ${maquettes[page]}`).toBe(true)

      const html = read(page)
      expect(html, 'le fichier doit être une page HTML complète').toMatch(/<html[\s>]/i)
      expect(html).toMatch(/<body[\s>]/i)
    })
  }
})

describe('leur contenu', () => {
  it('montre du texte sur chaque page, pas seulement des cadres vides', () => {
    for (const page of PAGES) {
      expect(
        visibleText(read(page)).length,
        `la page ${page} doit montrer ce que verra l’utilisateur`,
      ).toBeGreaterThan(80)
    }
  })

  it('propose un formulaire sur la page de connexion', () => {
    const html = read('connexion')
    expect(html, 'la connexion demande un formulaire').toMatch(/<form[\s>]/i)
    expect(html, 'avec un champ de mot de passe').toMatch(/type=["']?password/i)
  })
})
