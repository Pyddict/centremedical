FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ----- Dépendances complètes (nécessaires au build) -----
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ----- Build Next.js (sortie « standalone ») -----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Le CLI Prisma n'est pas tracé par la sortie standalone : on le met de côté
# avec ses seules dépendances, pour l'ajouter à l'image finale sans y embarquer
# l'intégralité de node_modules.
RUN node scripts/collect-prisma-cli.mjs /app/node_modules /app/prisma-cli-modules

# ----- Image finale -----
FROM base AS runner
ENV NODE_ENV=production
# Le serveur autonome écoute sur toutes les interfaces du conteneur.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Serveur autonome : n'embarque que les dépendances réellement utilisées
# (les dépendances de développement restent dans les étapes précédentes).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma : schéma, migrations et CLI, pour appliquer les migrations au démarrage.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma-cli-modules ./node_modules

RUN mkdir -p /app/uploads

EXPOSE 3000
# Applique les migrations en attente puis démarre le serveur.
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js migrate deploy && node server.js"]
