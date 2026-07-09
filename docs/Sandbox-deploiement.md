# Déploiement sandbox (Docker · Coolify / Dokploy)

> Sandbox = app Next.js conteneurisée (`Dockerfile`) pointant vers un **projet
> Supabase Cloud dédié**. Pas de `compose.yml` : un seul conteneur, l'app.
> Pour la prod, prévoir une config durcie (secrets gérés, backups, etc.).

## 1. Créer le projet Supabase Cloud

1. [supabase.com](https://supabase.com) → nouveau projet (gratuit suffit pour une sandbox).
2. Récupérer, dans **Project Settings** :
    - **API** → `Project URL`, `anon public`, `service_role` (secret).
    - **Database → Connection string → URI** (connexion **directe**, port 5432) → pour l'init.

## 2. Variables

> ⚠️ **Dokploy a 3 champs distincts** (vérifié sur la doc officielle) :
>
> - **Build-time arguments** → injectés **pendant le build** (= `ARG` du Dockerfile),
>   **persistent** dans l'image. C'est le SEUL moyen de fournir des valeurs au build
>   d'un Dockerfile — les **Environment Settings ne sont PAS passées au build**.
> - **Environment Settings** → injectés **au runtime** uniquement (`process.env` du
>   conteneur). Pas disponibles pendant le build.
> - **Build-time secrets** → pendant le build via `--mount=type=secret`, **ne persistent
>   pas**. Inutile ici (rien de sensible n'est requis au build ; l'anon key est publique).
>
> Comme Next **inline les `NEXT_PUBLIC_*` au build**, elles doivent être en
> **Build-time arguments** (noms = les `ARG` du Dockerfile). On les met **aussi** en
> Environment Settings comme filet pour les lectures serveur au runtime.
> Si elles manquent au build → bundle inliné à `undefined` → crash
> « Missing Supabase env vars in middleware » / « Your project's URL and Key are required ».

### Obligatoires

| Variable                                             | Build-time arguments | Environment Settings |
| ---------------------------------------------------- | :------------------: | :------------------: |
| `NEXT_PUBLIC_SUPABASE_URL` (Project URL)             |          ✅          |          ✅          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`anon public`)      |          ✅          |          ✅          |
| `NEXT_PUBLIC_APP_URL` (`https://sandbox.exemple.be`) |          ✅          |          ✅          |
| `SUPABASE_SERVICE_ROLE_KEY` (`service_role`, secret) |          —           |          ✅          |

### Optionnelles

| Variable                                                                                  | Build-time args | Environment | Rôle                    |
| ----------------------------------------------------------------------------------------- | :-------------: | :---------: | ----------------------- |
| `NEXT_PUBLIC_APP_NAME`                                                                    |       ✅        |     ✅      | nom affiché             |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`                                                          |       ✅        |     ✅      | reCAPTCHA (clé site)    |
| `RECAPTCHA_SECRET_KEY`                                                                    |        —        |     ✅      | reCAPTCHA (clé secrète) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                                     |        —        |     ✅      | emails                  |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` |        —        |     ✅      | OAuth Google            |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                      |        —        |     ✅      | rate-limit              |
| `CRON_SECRET`                                                                             |        —        |     ✅      | purge cache             |

> Sans Resend/Google/Upstash, l'app tourne en mode dégradé (emails ignorés,
> intégrations Google indisponibles, rate-limit en fallback mémoire).

## 3. Déployer (Coolify / Dokploy)

1. Nouvelle ressource **Application** → source = ce dépôt Git, branche voulue.
2. Build pack = **Dockerfile** (détecté automatiquement à la racine).
3. Renseigner les variables **build-time** et **runtime** (section 2).
4. Port exposé du conteneur : **3000** (mapper vers le domaine ; TLS géré par Coolify/Dokploy).
5. Déployer. Healthcheck intégré sur `/api/health`.

## 4. Initialiser la base (une fois)

Depuis un clone du repo (machine locale ou conteneur jetable), `pnpm install` puis :

```bash
DATABASE_URL='postgresql://postgres:MOT_DE_PASSE@db.xxxx.supabase.co:5432/postgres' \
  scripts/sandbox-init.sh
```

Le script applique les migrations `001 → 033` dans l'ordre, puis seed les données
de démo. Pour le seed, fournir aussi (via `.env.local` ou export) :
`NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.

**Comptes démo** (mot de passe `password`) :
`admin@vsp.local` · `marie@vsp.local` · `paul@vsp.local` · `sophie@vsp.local`

> Reset de la sandbox : repartir d'un **projet Supabase vierge** (les migrations
> historiques ne sont pas toutes idempotentes), puis relancer le script.

## 5. Build local (test)

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL='https://xxxx.supabase.co' \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJ…' \
  --build-arg NEXT_PUBLIC_APP_URL='http://localhost:3000' \
  -t vsp-sandbox .

docker run --rm -p 3000:3000 \
  -e SUPABASE_SERVICE_ROLE_KEY='eyJ…' \
  -e NEXT_PUBLIC_APP_URL='http://localhost:3000' \
  vsp-sandbox
```
