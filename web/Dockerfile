# Atria web — Next.js + Prisma/SQLite. Boots complete from the bundled program
# (data/program.json); the solver is only contacted at runtime for repair/generate/import.
FROM node:22-slim

WORKDIR /app
# openssl for Prisma; build tools in case better-sqlite3 needs to compile
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
# On boot: create the SQLite schema, load the bundled program, serve.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && npx tsx prisma/seed.ts && npx next start -p ${PORT:-3000} -H 0.0.0.0"]
