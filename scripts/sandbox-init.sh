#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Initialise la base d'une sandbox (projet Supabase Cloud NEUF) :
#   1. applique les migrations supabase/migrations/*.sql dans l'ordre
#   2. seed les données de démo (pnpm db:seed)
#
# À lancer UNE FOIS depuis un clone du repo, après avoir créé le projet Supabase.
# Pour « reset » la sandbox : repartir d'un projet vierge (les migrations ne sont
# pas toutes idempotentes).
#
# Pré-requis :
#   - psql (client PostgreSQL)
#   - pnpm + dépendances installées (pnpm install)
#   - DATABASE_URL = chaîne de connexion Postgres directe du projet Supabase
#       (Dashboard → Project Settings → Database → Connection string → URI).
#       ⚠️ Utiliser la connexion DIRECTE (port 5432), pas le pooler, pour le DDL.
#   - .env.local (ou variables exportées) avec, pour le seed :
#       NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#
# Exemple :
#   DATABASE_URL='postgresql://postgres:PWD@db.xxxx.supabase.co:5432/postgres' \
#     scripts/sandbox-init.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL manquant — chaîne de connexion Postgres directe du projet Supabase}"

command -v psql >/dev/null 2>&1 || { echo "✗ psql introuvable (installe le client PostgreSQL)"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "✗ pnpm introuvable"; exit 1; }

echo "▸ Application des migrations sur la base cible…"
for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "  → $(basename "$f")"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "✓ Migrations appliquées."

echo "▸ Seed des données de démo (pnpm db:seed)…"
cd "$ROOT"
pnpm db:seed

echo ""
echo "✓ Sandbox initialisée."
echo "  Comptes démo (mot de passe : password) :"
echo "    admin@vsp.local · marie@vsp.local · paul@vsp.local · sophie@vsp.local"
