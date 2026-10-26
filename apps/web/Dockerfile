ARG NODE_IMAGE=node:26.12.1-alpine3.24
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.6-alpine3.24

FROM ${NODE_IMAGE} AS build
ENV CI=true
RUN npm install --global pnpm@12.15.0
WORKDIR /app
COPY apps/web/package.json apps/web/pnpm-lock.yaml apps/web/pnpm-workspace.yaml apps/web/.npmrc ./
RUN pnpm install --frozen-lockfile
COPY apps/web ./
RUN pnpm build

FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web/browser /usr/share/nginx/html
USER 101
EXPOSE 8080
