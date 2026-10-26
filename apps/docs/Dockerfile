ARG NODE_IMAGE=node:26.12.1-alpine3.24
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.6-alpine3.24

FROM ${NODE_IMAGE} AS build
ENV CI=true
ENV ASTRO_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.15.0
WORKDIR /app
COPY apps/docs/package.json apps/docs/pnpm-lock.yaml apps/docs/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/docs ./
RUN pnpm run build

FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx/docs.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
