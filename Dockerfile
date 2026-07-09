# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile sandbox — app Next.js (standalone) pointant vers un projet Supabase
# Cloud. Voir docs/Sandbox-deploiement.md.
#
# ⚠️ Les variables NEXT_PUBLIC_* sont inlinées par Next au BUILD : elles doivent
#    être fournies en build-args (Coolify/Dokploy : variables de build).
#    Les secrets serveur (SUPABASE_SERVICE_ROLE_KEY, RESEND_*, GOOGLE_*, …) sont
#    lus au RUNTIME : à fournir en variables d'environnement du conteneur.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps : dépendances (cache pnpm) ----
FROM base AS deps
# pnpm-workspace.yaml porte les réglages pnpm 11 (overrides postcss +
# onlyBuiltDependencies esbuild/sharp) : indispensable au frozen install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- builder : build de production ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* — inlinés au build (présents dans le bundle client).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY \
    NEXT_TELEMETRY_DISABLED=1

# Diagnostic build (mêmes RUN que le build → s'imprime à chaque build réel).
# Crochets = révèlent guillemets/espaces parasites. URL + anon key sont publiques.
# À retirer une fois la config validée.
RUN echo "BUILD NEXT_PUBLIC_SUPABASE_URL=[$NEXT_PUBLIC_SUPABASE_URL]" \
    && echo "BUILD NEXT_PUBLIC_APP_URL=[$NEXT_PUBLIC_APP_URL]" \
    && echo "BUILD NEXT_PUBLIC_SUPABASE_ANON_KEY length: ${#NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
    && pnpm build

# ---- runner : image finale minimale ----
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Sortie standalone : server.js + node_modules tracés, + static & public.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Health : la route /api/health existe dans l'app.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
