# The cabinet's web app (Д31): built without mocks against the API, served by nginx, which also
# passes /api to the API container. Built from the repository root:
#   docker build -f deploy/web.Dockerfile -t rvd-web .
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci

COPY . .
# Real sign-in and every screen on the API; the demo's mocks stay out of the bundle's way.
ENV VITE_USE_MOCKS=false VITE_LIVE_API=true VITE_API_BASE_URL=/api
RUN npm run build && rm -f dist/mockServiceWorker.js

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
