---
title: ADR-005 Docker Compose and manual execution
description: Decision to support both Docker Compose and running each application manually.
---

## Status

Implemented for PostgreSQL and the API: Compose development/production configuration, the API Dockerfile and environment samples exist; the image builds, runs non-root and serves `/health`. Development Compose startup was verified against PostgreSQL. Web and docs services remain Planned. Production is not deployed.

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

The API Dockerfile is multi-stage with a development stage and a non-root runtime stage. Compose uses a common file plus `compose.dev.yaml` or `compose.prod.yaml`, a PostgreSQL volume, a health check the API waits for, a loopback-only PostgreSQL port in development and none in production. Image storage volumes remain Planned.

## Future improvements

Add CI checks that both paths work.
