---
title: ADR-021 Delivery with Docker Compose and a CI workflow
description: Decision to run the whole system with Docker Compose, serve the web and docs builds from pinned unprivileged nginx images with a same-origin /api proxy, and check every application in a GitHub Actions workflow that does not deploy.
---

## Status

| Capability | Status |
|---|---|
| Web and docs Dockerfiles on pinned Node and unprivileged nginx images | Implemented |
| Same-origin proxy of `/api` from the web container to the API | Implemented |
| One ignore file per Dockerfile (`Dockerfile.dockerignore`) | Implemented |
| Compose services `web` and `docs` in `compose.yaml`, `compose.dev.yaml` and `compose.prod.yaml` | Implemented |
| GitHub Actions workflow `.github/workflows/ci.yml` | Implemented as written; it has not run on GitHub yet because the repository has no remote |
| Playwright in CI | Considered |
| Publishing images to a registry | Considered |
| Deployment and continuous delivery | Considered |

## Problem

The API and PostgreSQL already ran in Compose (ADR-005), but the web app and the docs ran only by hand, so a reviewer needed three terminals and two toolchains to see the system. The web app calls `/api` on its own origin, so serving it from a container needs a way to reach the API without a CORS policy. Nothing checked automatically that the three applications still build, lint and pass their tests.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Serve the web build from the Angular dev server in a container | A development server in a runtime image, with the full toolchain inside it. |
| Serve the web build from the API with static files | Couples the two applications that ADR-008 keeps independent, and the API would need a frontend build to start. |
| Call the API from the browser on another origin with a CORS policy | Adds a policy and a second public address for no requirement; same-origin needs neither. |
| The official `nginx` image | Runs the master process as root and listens on port 80. The unprivileged variant runs as user 101 on port 8080. |
| One shared `.dockerignore` at the root for every image | One context rule for three different builds; each image would receive files it does not need. Docker reads `<Dockerfile>.dockerignore` next to each Dockerfile, so every build ships only its own application. |
| A CI pipeline that also runs Playwright | Needs the full stack, the seed and administrator credentials inside the runner; more moving parts than the delivery justifies. |
| No CI | Breakage would show only when someone runs every command by hand. |

## Decision

| Topic | Decision |
|---|---|
| Web image | `apps/web/Dockerfile` builds with `node:26.12.1-alpine3.24` and `pnpm@12.15.0` from the frozen lockfile, then copies `dist/web/browser` into `nginxinc/nginx-unprivileged:1.30.6-alpine3.24`, running as user 101 and listening on 8080. |
| Docs image | `apps/docs/Dockerfile` builds the static site with the same Node and pnpm and serves `dist` from the same nginx image, with Astro telemetry disabled. |
| Web nginx | `docker/nginx/web.conf` proxies `/api/` to `http://api:8080` through the Docker resolver, forwards the host, client address and scheme, allows request bodies up to 12 MiB (`client_max_body_size 12m`) for image uploads, falls back to `index.html` for client routes and caches the hashed assets for a year. |
| Docs nginx | `docker/nginx/docs.conf` serves the static pages, caches `/_astro/` for a year and answers `404.html` for unknown paths. |
| Ignore files | `apps/web/Dockerfile.dockerignore` and `apps/docs/Dockerfile.dockerignore` exclude everything except their application and their nginx file, and always exclude `.env` files, keys, `node_modules` and build output. |
| Compose | `web` and `docs` join `compose.yaml` with health checks. `compose.dev.yaml` publishes them on `127.0.0.1` at `WEB_HTTP_PORT` (4200) and `DOCS_HTTP_PORT` (4321) next to the API on `API_HTTP_PORT` (5080); `compose.prod.yaml` does the same with the production API port. |
| CI | `.github/workflows/ci.yml` runs on push and pull request with read-only permissions and four jobs: `web` (install, lint, typecheck, `pnpm test:coverage`, build), `docs` (check, build), `api` (Release build, `dotnet format --verify-no-changes`, every backend suite against a PostgreSQL 17 service) and `images` (builds the three Dockerfiles). |
| Not in CI | Playwright, because it needs the running seeded stack and the administrator credentials. It runs locally, as described in Development. Nothing is published or deployed. |

## Justification

nginx serves static files well and its unprivileged image removes root from the runtime without extra configuration. Proxying `/api` keeps the browser on one origin, the same model as the Angular dev server proxy in development, so the client code is identical in both and no CORS policy is needed. Per-Dockerfile ignore files keep each build context small and keep secrets out of every image. The workflow repeats the commands developers already run, so a green run means the same as a green local run.

## Advantages

- One command starts the whole system, with the seed in development.
- The runtime images contain no build toolchain and run as non-root users.
- The web app needs no API address or CORS configuration.
- The build of each application stays independent.
- Lint, types, unit tests, coverage thresholds, backend suites and image builds are checked on every push.

## Disadvantages

- nginx resolves the API through the Docker DNS, so the web image only proxies inside a Compose network with a service named `api`.
- The development stack builds the web and docs images instead of using their live-reload servers; for fast front-end work the manual path is quicker.
- Playwright is not part of CI, so a regression in the browser flows is seen only when someone runs it.
- The workflow has not run on GitHub, so action versions and runner behavior are unverified.

## Consequences

Reviewers start the stack with `docker compose --env-file .env.dev -f compose.dev.yaml up --build` and open the web app, the docs and the API on loopback ports. Adding a new file that a build needs means updating its `Dockerfile.dockerignore`. Changing a test or build command means changing the workflow in the same change. The missing production pieces, such as HTTPS, security headers and backups, are listed in [Production considerations](../production-considerations.md).

- Pages link to each other with relative `.md` paths so that they also read well on GitHub. Astro does not rewrite those paths, so a small local integration (`apps/docs/src/plugins/markdown-links.mjs`) rewrites them to site routes in the built HTML after the build. It adds no dependency, and the development server does not run it, so those links only resolve in the built site.

## Future improvements

- Run the workflow on GitHub once a remote exists and fix what it finds.
- Run Playwright in CI against the Compose stack with credentials from repository secrets.
- Publish versioned images to a registry and add a deployment job.
- Add dependency and image scanning.
