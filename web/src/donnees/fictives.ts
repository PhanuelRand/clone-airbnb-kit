/**
 * Des données fictives, pour construire vos écrans avant que l'API existe.
 *
 * Au module 3, vos pages lisent ce fichier. Dans les modules suivants, chaque
 * page le remplace par un appel à votre API, une page à la fois. Quand plus
 * aucun écran ne l'importe, supprimez-le.
 *
 * Les montants sont en ariary entiers, comme dans votre base : l'ariary n'a pas
 * de centimes. Les logements, les hôtes et les avis sont inventés.
 */

export type AnnonceFictive = {
  id: string
  titre: string
  ville: string
  prixParNuit: number
  capacite: number
  commodites: string[]
  note: number | null
  hote: string
  latitude: number
  longitude: number
}

export const annoncesFictives: AnnonceFictive[] = [
  {
    id: 'a1',
    titre: 'Maison en bois face au canal des Pangalanes',
    ville: 'Toamasina',
    prixParNuit: 120_000,
    capacite: 4,
    commodites: ['wifi', 'cuisine', 'moustiquaires'],
    note: 4.8,
    hote: 'Voahirana',
    latitude: -18.1492,
    longitude: 49.4023,
  },
  {
    id: 'a2',
    titre: 'Appartement lumineux près d’Analakely',
    ville: 'Antananarivo',
    prixParNuit: 85_000,
    capacite: 2,
    commodites: ['wifi', 'eau chaude'],
    note: 4.6,
    hote: 'Tojo',
    latitude: -18.9079,
    longitude: 47.5256,
  },
  {
    id: 'a3',
    titre: 'Bungalow sur la plage d’Ambatoloaka',
    ville: 'Nosy Be',
    prixParNuit: 210_000,
    capacite: 3,
    commodites: ['climatisation', 'accès plage', 'petit-déjeuner'],
    note: 4.9,
    hote: 'Haja',
    latitude: -13.3935,
    longitude: 48.2155,
  },
  {
    id: 'a4',
    titre: 'Chambre calme dans une villa d’Ivato',
    ville: 'Antananarivo',
    prixParNuit: 60_000,
    capacite: 1,
    commodites: ['wifi', 'navette aéroport'],
    note: null,
    hote: 'Fanja',
    latitude: -18.7969,
    longitude: 47.4788,
  },
  {
    id: 'a5',
    titre: 'Case familiale au bord du lac Andraikiba',
    ville: 'Antsirabe',
    prixParNuit: 95_000,
    capacite: 6,
    commodites: ['cuisine', 'cheminée', 'parking'],
    note: 4.7,
    hote: 'Rivo',
    latitude: -19.8659,
    longitude: 46.9938,
  },
  {
    id: 'a6',
    titre: 'Studio avec terrasse sur la baie',
    ville: 'Mahajanga',
    prixParNuit: 75_000,
    capacite: 2,
    commodites: ['wifi', 'climatisation', 'terrasse'],
    note: 4.5,
    hote: 'Lova',
    latitude: -15.7167,
    longitude: 46.3167,
  },
]

/** Affiche un montant en ariary : 120 000 Ar. */
export function formaterAriary(montant: number) {
  return new Intl.NumberFormat('fr-MG', {
    style: 'currency',
    currency: 'MGA',
    maximumFractionDigits: 0,
  }).format(montant)
}
