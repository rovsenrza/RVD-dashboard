# The API (apps/api) with the shared contracts (Д31). Built from the repository root:
#   docker build -f deploy/api.Dockerfile -t rvd-api .
# Migrations run on start; the sync worker, the outbox and the mail worker start with it.
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
# tsx runs the TypeScript sources as they are, the way `npm start` does.
RUN npm ci --workspace=@rvd/api --workspace=@rvd/contracts --include=dev \
  && npm cache clean --force

COPY packages/contracts packages/contracts
COPY apps/api apps/api

# Uploaded files live in a volume mounted here; the directory is the node user's.
RUN mkdir -p /data/files && chown -R node:node /data
ENV NODE_ENV=production FILES_DIR=/data/files TRUST_PROXY=true

WORKDIR /app/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD wget -qO- http://127.0.0.1:3001/health >/dev/null || exit 1
CMD ["npx", "tsx", "src/server.ts"]
