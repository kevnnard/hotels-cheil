---
title: ADR-005 Docker Compose and manual execution
description: Decision to support both Docker Compose and running each application manually.
---

## Status

Implemented for the whole system: `compose.yaml` declares `db`, `migrator`, `api`, `web` and `docs`; `compose.dev.yaml` is self-contained and adds the development `seed`; `compose.prod.yaml` is the production overlay. The API, web and docs Dockerfiles and the environment samples exist, and every application also runs without Docker. The web and docs images are described in [ADR-021](adr-021-delivery-compose-and-ci.md). Production is not deployed.

## Problem

Reviewers need one command to start everything, while developers need fast independent runs.

## Alternatives considered

- Docker Compose only.
- Manual execution only.
- Both.

## Decision

Provide Docker Compose for PostgreSQL, API, web and docs, and keep every application runnable without Docker.

## Justification

Compose gives reproducibility; manual execution keeps applications independent and easy to debug.

## Advantages

- Reproducible environment.
- No hard dependency on Docker for development.

## Disadvantages

- Two paths to document and keep working.
- Compose files and Dockerfiles need maintenance.

## Consequences

The API Dockerfile is multi-stage with a development stage and a non-root runtime stage. Compose uses a common file plus `compose.dev.yaml` or `compose.prod.yaml`, a PostgreSQL volume, a health check the API waits for, a loopback-only PostgreSQL port in development and none in production. The API mounts the named volume `hotel-images` for the image files. The web and docs services run from unprivileged nginx images, and the web container proxies `/api` to the API (ADR-021).

## Future improvements

The CI workflow of ADR-021 builds every application and image; running the Compose stack itself in CI is not done.
