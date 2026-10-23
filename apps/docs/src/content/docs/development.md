---
title: Development
description: Requirements, setup, configuration, testing, build and deployment, with the status of each item.
---

The API skeleton and its PostgreSQL persistence layer exist. The API does not use the database yet: `Program.cs` only serves `/health`. Status per item is given below; anything not marked Implemented is Planned.

## Requirements

.NET 10 with SDK 10.0.402, pinned in `apps/api/global.json` (ADR-009). Versions of Node, Angular, Tailwind and Starlight are pending decisions. Docker is optional because manual execution must work (ADR-005).

## Installation and local development

| Item | Status |
|---|---|
| Run API without Docker | Implemented for the skeleton |
| Run web without Docker | Planned |
| Run docs without Docker | Planned |
| Docker Compose with PostgreSQL and API | Implemented and verified for development; production configuration/image verified, not deployed |
| Docker Compose with web and docs | Planned |

From the repository root:

```bash
dotnet restore apps/api/HotelManagement.slnx
dotnet build apps/api/HotelManagement.slnx
dotnet run --project apps/api/src/HotelManagement.Api --launch-profile http
```

The API listens on `http://localhost:5080`, a development-only HTTP profile with no TLS and no authentication. `GET /health` returns `200` with the body `Healthy`. Use `dotnet watch --project apps/api/src/HotelManagement.Api --launch-profile http` to reload on changes.

## Environment files and secrets

ASP.NET Core does not load `.env` files. The files are read by Docker Compose through `--env-file`, or sourced into the shell for manual runs. Real files are ignored by Git; only the samples are versioned and their secret values are empty.

```bash
cp .env.dev.example .env.dev
openssl rand -hex 24
```

Put the generated value after `POSTGRES_PASSWORD=` in `.env.dev`. Use letters and digits only; Compose treats `$` specially. Repeat with `.env.prod.example` and `.env.prod` for production values, using a different password.

## Docker Compose

Two variants share `compose.yaml`. Each has its own project name and therefore its own volume. The volume name includes the PostgreSQL major (`postgres-17-data`); never mount it with another major.

| Variant | Command | Notes |
|---|---|---|
| Development | `docker compose --env-file .env.dev -f compose.yaml -f compose.dev.yaml up --build` | SDK stage with `dotnet watch`; PostgreSQL published on `127.0.0.1` only |
| Production check | `docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml config` | Non-root runtime image; no PostgreSQL host port; nothing is deployed |

Build the production image with `docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml build`. The API waits for the database health check. Missing secrets stop Compose with an error.

## Manual execution with PostgreSQL

Start any PostgreSQL 17 server, then export the variables and the connection string in the same shell as the process:

```bash
set -a
. ./.env.dev
set +a
export ConnectionStrings__Hotels="Host=localhost;Port=${POSTGRES_HOST_PORT};Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}"
```

The connection string is only used by the migration tool and by code that calls `AddHotelPersistence`, which the API does not call yet.

## Configuration

Implemented: `appsettings.json`, `appsettings.Development.json`, the development launch profile and the environment samples `.env.dev.example` and `.env.prod.example`. Options Pattern and authentication settings remain Planned. Environment variables override ASP.NET Core configuration, using `__` for nesting (`ConnectionStrings__Hotels`). Secrets never enter Git.

## Migrations

Implemented: versioned EF Core migrations in `HotelManagement.Infrastructure/Persistence/Migrations`, run through the local tool `dotnet-ef` 10.0.13. Commands take the connection from the environment explicitly; there is no default.

```bash
cd apps/api
dotnet tool restore
dotnet ef migrations add <Name> --project src/HotelManagement.Infrastructure --output-dir Persistence/Migrations
dotnet ef database update --project src/HotelManagement.Infrastructure
```

Source the environment and export `ConnectionStrings__Hotels` as shown above before `database update`. Generated migration files must have their comment headers removed to respect the zero comments policy.

## Testing

| Layer | Plan | Status |
|---|---|---|
| Backend domain | xUnit unit tests: `dotnet test apps/api/tests/HotelManagement.Domain.Tests` | Implemented |
| Backend persistence | xUnit against a real PostgreSQL 17 database (rows, constraints, concurrent ratings) | Implemented |
| Backend services, authorization, images, HTTP integration | xUnit | Planned |
| Frontend | Component, form, service, interceptor, guard and filter tests, plus end-to-end tests for critical flows | Planned |
| Instructions | `node .pi/scripts/verify-instructions.mjs` structural check | Implemented |

Persistence tests need `HOTEL_TEST_CONNECTION` to point to a database named `hotels_test` on a disposable PostgreSQL 17 server. The suite creates and drops its own uniquely named database and fails, never skips, when the variable or server is missing:

```bash
HOTEL_TEST_CONNECTION='<connection string with Database=hotels_test>' dotnet test apps/api/tests/HotelManagement.Infrastructure.Tests
```

The instruction validator checks structure only: required files, frontmatter, sections, links, ADR sections, absence of machine paths, obvious secrets and comment syntax in the script. It cannot prove that an agent followed the rules.

## Build and deployment

Implemented and verified: building with `dotnet build apps/api/HotelManagement.slnx`; the multi-stage API image builds, runs as a non-root user and serves `/health`; development Compose starts PostgreSQL and the API successfully. Deployment and the deployment target remain Planned.

## Working method

ODD (Organic Driven Development) as described in `AGENTS.md`: authorize scope, explore conventions, resolve real uncertainty, track substantial work, implement acceptance- and test-first where meaningful, then verify and close truthfully. Details in the agents page.
