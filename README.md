# Kadastr

Application web moderne pour la visualisation, l’analyse et la gestion de données cadastrales et géospatiales, construite avec Next.js 15, React 19 et TypeScript.

- Démo/Production: https://kadastr-eight.vercel.app
- Référentiel: https://github.com/Okpeyemi/kadastr

## Sommaire

- [Aperçu](#aperçu)
- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Langages du dépôt](#langages-du-dépôt)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration (variables d’environnement)](#configuration-variables-denvironnement)
- [Utilisation](#utilisation)
- [Scripts NPM](#scripts-npm)
- [Déploiement](#déploiement)
- [Qualité du code](#qualité-du-code)
- [Sécurité des secrets](#sécurité-des-secrets)
- [Contribution](#contribution)
- [Feuille de route](#feuille-de-route)
- [Licence](#licence)
- [Crédits](#crédits)

---

## Aperçu

Kadastr met à disposition une interface cartographique performante (Mapbox GL JS) pour:
- explorer des couches vectorielles (GeoJSON),
- effectuer des opérations géospatiales courantes (buffer, intersections…),
- importer/exporter des données tabulaires (CSV/XLSX),
- organiser et analyser les enregistrements via des tableaux puissants (TanStack Table),
- s’intégrer à des services modernes pour l’authentification, le stockage et le streaming de fichiers.

L’application est optimisée pour un déploiement sur Vercel et exploite Turbopack pour des builds rapides.

## Fonctionnalités

- Cartographie interactive avec Mapbox GL JS 3.x
- Outils géospatiaux (Turf.js): buffer, intersections, helpers
- Projection et reprojection (Proj4)
- Import/export de données:
  - CSV (PapaParse)
  - Excel (xlsx)
- Tableaux dynamiques et filtrage (TanStack Table)
- UI accessible et modulable (Radix UI, Lucide, Tabler Icons)
- Thèmes clair/sombre (next-themes)
- Animations (Framer Motion, Lottie)
- Notifications utilisateur (sonner)
- Rendu Markdown avec prise en charge GFM (react-markdown + remark-gfm)
- Intégrations:
  - Supabase (SDK) pour données/stockage/auth selon votre configuration
  - @vercel/blob pour le stockage de fichiers compatible Vercel
  - API Google Generative AI (si activée)
- Validation côté front (Zod)
- Optimisation d’images (sharp)

Remarque: certaines intégrations (Supabase, Google GenAI, Blob) sont optionnelles et nécessitent la configuration des clés.

## Stack technique

- Framework: Next.js 15 (App Router), React 19, TypeScript
- Styles: Tailwind CSS 4
- Carto & Geo: mapbox-gl, @turf/turf, proj4, rbush
- Données: papaparse, xlsx
- UI/UX: @radix-ui/*, lucide-react, @tabler/icons-react, framer-motion, lottie-react, sonner
- Tables: @tanstack/react-table
- Markdown: react-markdown, remark-gfm
- Plateforme: Vercel (recommandé), @vercel/blob
- Backend as a Service: @supabase/supabase-js
- Validation: zod
- Outils: Turbopack, ESLint

## Langages du dépôt

Répartition approximative:
- TypeScript ≈ 74.5%
- HTML ≈ 19.8%
- JavaScript ≈ 4.1%
- CSS ≈ 1.0%
- Python ≈ 0.6%

## Prérequis

- Node.js 20 LTS (recommandé) ou ≥ 18.18
- npm (ou yarn/pnpm selon préférence)
- Compte Mapbox si vous utilisez la carte (clé d’accès)
- Comptes/tokens pour integrations optionnelles (Supabase, Vercel Blob, Google GenAI)

## Installation

```bash
# 1) Cloner le dépôt
git clone https://github.com/Okpeyemi/kadastr.git
cd kadastr

# 2) Installer les dépendances
npm install

# 3) Configurer les variables d'environnement
cp .env.example .env.local   # si vous utilisez un fichier d'exemple
# puis éditer .env.local

# 4) Lancer en développement
npm run dev
```

L’application sera disponible par défaut sur http://localhost:3000.

## Configuration (variables d’environnement)

Les intégrations suivantes sont facultatives mais recommandées si vous souhaitez activer toutes les fonctionnalités.

Exemple de contenu pour `.env.local`:

```bash
# Carte (Mapbox)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.********************************

# Supabase (si utilisé pour auth/DB/stockage)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google Generative AI (si utilisé)
# Utilisé par @google/generative-ai ou @google/genai
GOOGLE_API_KEY=AIza********************************

# Vercel Blob (stockage fichiers) - utile en local
# Vercel injecte automatiquement les tokens en production.
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_********************************

# Optionnel
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Bonnes pratiques:
- Toute clé utilisée côté client doit être préfixée par `NEXT_PUBLIC_`.
- Gardez les secrets non préfixés côté serveur uniquement.

## Utilisation

- Développement: `npm run dev` (Turbopack)
- Build de production: `npm run build`
- Démarrage en production: `npm run start`

Selon votre configuration, vous pourrez:
- Charger des couches GeoJSON et interagir avec la carte (zoom, sélection, info-bulles, etc.).
- Importer/exporter des données CSV/XLSX.
- Lancer des opérations géospatiales (buffer, intersection).
- Afficher des tableaux et réaliser des tris/filtrages.
- Gérer des fichiers via Vercel Blob (upload/serve).
- Utiliser Supabase pour stocker ou authentifier vos utilisateurs.
- Générer ou résumer du contenu via l’API Google Generative AI.

## Scripts NPM

```json
{
  "dev":   "next dev --turbopack",
  "build": "next build --turbopack",
  "start": "next start",
  "lint":  "eslint"
}
```

## Déploiement

### Vercel (recommandé)
1. Connectez le dépôt GitHub à Vercel.
2. Ajoutez vos variables d’environnement dans le projet Vercel (onglet Settings > Environment Variables).
3. Commande de build: `npm run build`
4. Démarrage: `next start` (géré automatiquement par Vercel pour un projet Next.js)
5. Déployez. Les tokens Blob sont injectés automatiquement en production par Vercel si vous utilisez @vercel/blob.

### Autres plateformes
- Générer le build: `npm run build`
- Servir l’app: `npm run start` derrière un proxy/PM2/Nginx.
- Assurez-vous que toutes les variables d’environnement sont présentes sur l’hôte.

## Qualité du code

- Linting: ESLint (`npm run lint`)
- Type checking: TypeScript
- Style: Tailwind CSS 4
- Recommandé: activer CI (lint/type-check/build) sur pull requests.

## Sécurité des secrets

- Ne commitez jamais vos clés privées.
- Utilisez `.env.local` en développement (git-ignoré par défaut dans Next.js).
- Préfixez par `NEXT_PUBLIC_` uniquement ce qui peut être exposé au client.
- Sur Vercel, stockez tous les secrets dans “Environment Variables”.

## Contribution

Les contributions sont bienvenues!
- Forkez le dépôt et créez une branche de fonctionnalité (`feat/ma-fonctionnalite`).
- Ouvrez une pull request descriptive (contexte, motivation, captures si possible).
- Assurez-vous que le lint et le build passent.

## Feuille de route

- [ ] Outils de dessin/édition géométrique avancés sur la carte
- [ ] Import/Export GeoPackage/Shapefile (via conversions serveur)
- [ ] Système de rôles/permissions granulaires (si Supabase/Row Level Security)
- [ ] Tests E2E/Unitaires
- [ ] Internationalisation (i18n) complète
- [ ] Documentation utilisateur intégrée

## Licence

Aucune licence n’est déclarée dans ce dépôt au 2025-09-26. 
Conseil: ajoutez une licence (par ex. MIT) via un fichier `LICENSE` pour clarifier les conditions d’utilisation.

## Crédits

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [Turf.js](https://turfjs.org/)
- [Proj4](https://proj4.org/)
- [Supabase](https://supabase.com/)
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- [TanStack Table](https://tanstack.com/table)
- [Radix UI](https://www.radix-ui.com/)
- [Lucide](https://lucide.dev/) / [Tabler Icons](https://tabler.io/icons)
- [Framer Motion](https://www.framer.com/motion/)
- [PapaParse](https://www.papaparse.com/)
- [xlsx](https://github.com/SheetJS/sheetjs)
- [Zod](https://zod.dev/)
- [React Markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm)

---

Fait avec ❤️ par l'équipe Underdogz.