FROM node:22.23.4-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS build
WORKDIR /src
COPY package.json package-lock.json ./
# The `prepare` script is `cd .. && husky ui/.husky`. With ui/ as the build context its parent is
# not the repository, so husky would fail. Deleting only it is narrower than --ignore-scripts,
# which would also skip the native postinstalls swc and friends need.
RUN npm pkg delete scripts.prepare && npm ci
COPY . .
# Compiled into the bundle by Vite, with no runtime override. Unset, it falls back to upstream's
# .env.cloud-production (api.jetkvm.com); the CI workflow sets it. Declared after npm ci so a
# change does not invalidate the dependency layer.
ARG VITE_CLOUD_API
# build:prod compiles paraglide i18n, runs tsc, then `vite build --mode=cloud-production`.
RUN npm run build:prod

# Pinned by the multi-arch index digest.
FROM nginx:1.31.8-alpine@sha256:1ef7ca94d7879df82421428ce13bd1eaa412404953859cf7a5b6512c25e67a60
COPY --from=build /src/dist /usr/share/nginx/html
# The build context's file modes are not guaranteed; an unreadable file is a 403 from nginx.
RUN chmod -R a+rX /usr/share/nginx/html
# SPA fallback, but not for /assets/: a missing hashed bundle must stay a 404, or a stale deploy
# looks like a page that renders nothing, with 200s all the way down. index.html must revalidate
# on every load (no validators, no-cache) so a browser never keeps one pointing at gone chunks.
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
