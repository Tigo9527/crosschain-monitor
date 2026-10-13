FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json yarn.lock ./
# The legacy Hardhat development tooling declares an older Node engine range.
# These services use MySQL and the SDKs' JavaScript implementations; skip native
# install scripts for the unused SQLite/Hardhat tooling in the legacy lockfile.
RUN yarn install --frozen-lockfile --non-interactive --ignore-engines --ignore-scripts \
    && yarn cache clean

COPY tsconfig.json ./
COPY lib ./lib
COPY sync ./sync
COPY web ./web
COPY test ./test
RUN npm run compile -- --incremental false \
    && npm run test:celer \
    && node -e "require('mysql2'); require('./sync/Sync.js'); require('./sync/CfxPoolMonitor.js'); require('./sync/fetcher/runMeson.js')"

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/sync ./sync
COPY --from=build --chown=node:node /app/web ./web
USER node
CMD ["node", "web/WebApp.js"]
