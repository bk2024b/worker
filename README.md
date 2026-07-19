# ProspectIQ — Worker de scraping

Service Node hébergé (pas Vercel, pas de machine locale) qui reçoit une
recherche, scrape Google Maps directement avec Playwright, puis écrit les
prospects et leur score initial dans Supabase.

## Endpoint

```
POST /scrape
Authorization: Bearer <WORKER_SECRET>
Body: { "searchId": "...", "niche": "restaurants", "city": "Cotonou", "userId": "..." }
```

Répond `202` immédiatement (le scraping continue en tâche de fond) et met à
jour `searches.status` (`running` → `done` / `failed`) au fur et à mesure.

## Déploiement (Railway — le plus simple)

1. Pousse ce dossier `worker/` dans son propre repo Git (ou un sous-dossier,
   Railway sait déployer un sous-répertoire).
2. Sur Railway : *New Project → Deploy from GitHub → sélectionner le repo*.
   Railway détecte le `Dockerfile` automatiquement.
3. Ajoute les variables d'environnement (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_SECRET`).
4. Une fois déployé, copie l'URL publique dans `WORKER_URL` côté app
   Next.js (même valeur pour `WORKER_SECRET` des deux côtés).

Fly.io et Render fonctionnent identiquement avec le même `Dockerfile`.

## Sur la fiabilité du scraping direct

À noter honnêtement, pas pour décourager mais pour calibrer les attentes :

- Google modifie régulièrement le DOM de Maps — les sélecteurs dans
  `scraper.ts` (`data-item-id`, `div.F7nice`, etc.) peuvent casser sans
  prévenir. C'est un scraper à surveiller, pas un système qu'on branche et
  qu'on oublie.
- Le scraping direct de Google Maps est en dehors des conditions
  d'utilisation officielles de Google — c'est un choix assumé pour rester
  gratuit au stade MVP, à garder en tête si le volume grossit un jour
  (passage à l'API Places deviendrait plus défendable à plus grande échelle).
- Pour limiter les blocages : le worker traite une recherche à la fois,
  avec des délais aléatoires entre chaque scroll/clic. Si tu scales à
  plusieurs recherches simultanées, il faudra ajouter une vraie file
  d'attente (BullMQ + Redis, par exemple) plutôt que de tout lancer en
  parallèle.

## Prochaine étape

Le module d'audit Lighthouse (HTTPS, responsive, vitesse, SEO) — il
s'insérera juste après l'insertion de chaque prospect, avant le calcul du
score définitif.
