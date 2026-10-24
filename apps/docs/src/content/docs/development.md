---
title: Development
description: Requirements, setup, configuration, testing, build and deployment, with the status of each item.
---

The API skeleton, its PostgreSQL persistence layer, the authentication endpoints and the hotel management endpoints exist. The API uses the database and requires the connection string to start. Status per item is given below; anything not marked Implemented is Planned.

## Requirements

.NET 10 with SDK 10.0.402, pinned in `apps/api/global.json` (ADR-009). The documentation site runs on Astro 7.4.2 and Starlight 0.42.7 with Node 26.12.0 and pnpm; the versions of Angular and Tailwind are pending decisions. Docker is optional because manual execution must work (ADR-005).

## Installation and local development

| Item | Status |
|---|---|
| Run API without Docker | Implemented for the skeleton |
| Run web without Docker | Planned |
| Run docs without Docker | Implemented with pnpm |
| Docker Compose with PostgreSQL and API | Implemented and verified for development; production configuration/image verified, not deployed |
| Docker Compose with web and docs | Planned |

From the repository root:

```bash
dotnet restore apps/api/HotelManagement.slnx
dotnet build apps/api/HotelManagement.slnx
dotnet run --project apps/api/src/HotelManagement.Api --launch-profile http
```

The API listens on `http://localhost:5080`, a development-only HTTP profile with no TLS. `GET /health` returns `200` with the body `Healthy`. Use `dotnet watch --project apps/api/src/HotelManagement.Api --launch-profile http` to reload on changes.

The API now needs PostgreSQL and the authentication settings. Export the connection string and the JWT issuer and audience before starting it:

```bash
export ConnectionStrings__Hotels="Host=localhost;Port=5433;Database=hotels_dev;Username=hotels_dev;Password=<the password from .env.dev>"
export Authentication__Jwt__Issuer=hotels-api
export Authentication__Jwt__Audience=hotels-api-clients
```

The development launch profile already provides the issuer and the audience. The connection string has no default and must come from the environment. Apply the migrations before the first run, as described in Migrations.

## Documentation site

The site in `apps/docs` is independent of the API and needs no database. From the repository root:

```bash
cd apps/docs
pnpm install
pnpm run dev
```

The development server serves the site at <http://localhost:4321>, whose home page is the interactive architecture canvas; the introduction and status table are at <http://localhost:4321/overview/> and the previous canvas address <http://localhost:4321/architecture/canvas/> keeps working. `pnpm run build` writes the static site to `apps/docs/dist`, `pnpm run preview` serves that build and `pnpm run check` runs the Astro type check. Editing `apps/docs/src/data/architecture.ts` updates the canvas.

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

Both variants share the base file, which declares a `migrator` service next to the database and the API. It applies the pending migrations once and exits, and the API starts only after it succeeds. The runtime image never changes the schema by itself.

Build the production image with `docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml build`. The API waits for the database health check and for the migration. Missing secrets stop Compose with an error.

## Manual execution with PostgreSQL

Start any PostgreSQL 17 server, then export the variables and the connection string in the same shell as the process:

```bash
set -a
. ./.env.dev
set +a
export ConnectionStrings__Hotels="Host=localhost;Port=${POSTGRES_HOST_PORT};Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}"
```

The connection string is used by the migration tool, by the API composition root and by the test fixtures. The API applies no migration at startup: the schema must be up to date before the process serves requests.

## Configuration

Implemented: `appsettings.json`, `appsettings.Development.json`, the development launch profile, the environment samples `.env.dev.example` and `.env.prod.example` and the authentication settings described in [Authentication](authentication.md). The Options Pattern is used for the JWT and the administrator bootstrap. Environment variables override ASP.NET Core configuration, using `__` for nesting (`ConnectionStrings__Hotels`, `Authentication__Jwt__SigningKey`). Secrets never enter Git.

The environment samples list the database credentials and the ports. The authentication variables are documented in [Authentication](authentication.md): the issuer, the audience, the token lifetime, the signing key and the first administrator. The samples do not carry them, because a file with the shape of a secret is a file that gets copied and shipped. The signing key and the administrator password have no default anywhere in the repository.

## Migrations

Implemented: versioned EF Core migrations in `HotelManagement.Infrastructure/Persistence/Migrations`, run through the local tool `dotnet-ef` 10.0.13. Commands take the connection from the environment explicitly; there is no default.

```bash
cd apps/api
dotnet tool restore
dotnet ef migrations add <Name> --project src/HotelManagement.Infrastructure --output-dir Persistence/Migrations
dotnet ef database update --project src/HotelManagement.Infrastructure
```

Source the environment and export `ConnectionStrings__Hotels` as shown above before `database update`. Generated migration files must have their comment headers removed to respect the zero comments policy. The API never migrates on startup, so run `database update` after every new migration.

## Testing

| Layer | Plan | Status |
|---|---|---|
| Backend domain | xUnit unit tests: `dotnet test apps/api/tests/HotelManagement.Domain.Tests` | Implemented |
| Backend persistence | xUnit against a real PostgreSQL 17 database (rows, constraints, concurrent ratings) | Implemented |
| Backend application services | xUnit unit tests over the authentication use cases with in-memory doubles | Implemented |
| Backend HTTP and authorization | xUnit over the real server against a real PostgreSQL 17 database (endpoints, tokens, revocation, policies) | Implemented |
| Backend end-to-end | xUnit over the API started as a separate process and reached over a real socket, against an isolated PostgreSQL 17 database (ADR-014) | Implemented |
| Frontend | Component, form, service, interceptor, guard and filter tests, plus end-to-end tests for critical flows | Planned |
| Instructions | `node .pi/scripts/verify-instructions.mjs` structural check | Implemented |

Persistence and HTTP tests need `HOTEL_TEST_CONNECTION` to point to a database named `hotels_test` on a disposable PostgreSQL 17 server. The suite creates and drops its own uniquely named database and fails, never skips, when the variable or server is missing:

```bash
HOTEL_TEST_CONNECTION='<connection string with Database=hotels_test>' dotnet test apps/api/tests/HotelManagement.Infrastructure.Tests
HOTEL_TEST_CONNECTION='<connection string with Database=hotels_test>' dotnet test apps/api/tests/HotelManagement.Api.Tests
HOTEL_TEST_CONNECTION='<connection string with Database=hotels_test>' dotnet test apps/api/tests/HotelManagement.E2E.Tests
```

The end-to-end suite starts the API as a separate process with `dotnet exec` over the built assembly, configured only through environment variables and with `ASPNETCORE_ENVIRONMENT=Production`. The server chooses its own loopback port and the suite reads the address it reports, so no port is reserved before the child binds it. The suite waits for `/health` before the first request, kills the process at the end and drops its database, and a startup that fails releases the process and the database before it reports the error. The inherited environment of the machine cannot alter that configuration, because every variable whose name matches one of the harness variables is removed before the child starts, including the variables written with the `DOTNET_` and the `ASPNETCORE_` prefixes that the host configuration reads. The secrets of the fixture reach the environment of the child process and are never printed, so the output of the process is redacted before it reaches a failure message. See [ADR-014](decisions/adr-014-end-to-end-tests-over-a-real-api-process.md).

The instruction validator checks structure only: required files, frontmatter, sections, links, ADR sections, absence of machine paths, obvious secrets and comment syntax in the script. It cannot prove that an agent followed the rules.

## Build and deployment

Implemented and verified: building with `dotnet build apps/api/HotelManagement.slnx`; the multi-stage API image builds, runs as a non-root user and serves `/health`; development Compose starts PostgreSQL and the API successfully. Deployment and the deployment target remain Planned.

## Working method

ODD (Organic Driven Development) as described in `AGENTS.md`: authorize scope, explore conventions, resolve real uncertainty, track substantial work, implement acceptance- and test-first where meaningful, then verify and close truthfully. Details in the agents page.
