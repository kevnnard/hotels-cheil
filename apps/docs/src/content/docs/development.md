---
title: Development
description: Requirements, setup, configuration, testing, build and deployment, with the status of each item.
---

The API skeleton, its PostgreSQL persistence layer, the authentication endpoints, the hotel management endpoints and the hotel image lifecycle exist. The API uses the database and requires the connection string to start. Status per item is given below; anything not marked Implemented is Planned.

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

In development the image files go to a per-user directory outside the repository unless `Storage__Images__RootPath` names another absolute directory. Outside development the setting is required, and the API refuses to start when the directory is relative, inside the application folder or not writable.

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

Two variants exist, each with its own project name and therefore its own volumes. The volume name includes the PostgreSQL major (`postgres-17-data`); never mount it with another major.

| Variant | Command | Notes |
|---|---|---|
| Development | `docker compose --env-file .env.dev -f compose.dev.yaml up --build` | Self-contained: database, migrator, API with `dotnet watch` and the seed; PostgreSQL and the API are published on `127.0.0.1` only |
| Production check | `docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml config` | Non-root runtime image; no PostgreSQL host port; nothing is deployed |

`compose.dev.yaml` does not need `compose.yaml`. It declares `db`, `migrator`, `api` and `seed`. The migrator applies the pending migrations once and exits with code 0, and the API starts only after it succeeds. The runtime image never changes the schema by itself. Production keeps using `compose.yaml` with `compose.prod.yaml`.

Development requires `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `ASPNETCORE_ENVIRONMENT`, `ADMINISTRATOR_EMAIL` and `ADMINISTRATOR_PASSWORD`; Compose stops with an error when one is missing. `JWT_SIGNING_KEY` stays optional in development, where the API uses an ephemeral key. `SEED_GUEST_PASSWORD` is optional and only used by the seed; when it is empty the seed skips the guest accounts and the ratings. It must follow the account password rules: 8 to 128 characters with at least one letter and one digit. The host ports default to `POSTGRES_HOST_PORT=5433` and `API_HTTP_PORT=5080`.

The API service mounts the named volume `hotel-images` at `/var/lib/hotel-images` and receives `Storage__Images__RootPath` pointing there. The volume belongs to the Compose project like the database volume, so removing the project volumes removes the images. The image directory is never part of a source bind mount.

### Development seed

The `seed` service runs once on every `up` and then exits. It uses the pinned image `python:3.13.9-alpine3.22`, mounts `docker/seed` read-only and has `restart: "no"`. The script `docker/seed/seed_hotels.py` uses only the Python standard library and reads the hotels from `docker/seed/hotels.json`: 30 fictitious hotels in English across many countries, with name, description, address and contact, using `example.test` emails and `example.com` websites. Every hotel has a nightly price in USD between 120 and 950 (`pricePerNight`), and ten of them also have a discount between 10 and 30 percent (`discountPercent`), following ADR-018. The hotels have no categories or amenities.

Photos are linked by data. A hotel's `image` field names a JPEG file in `docker/seed/images` for the primary position, and an optional `images` list names up to two more files for positions 1 and 2. Adding a photo therefore means adding the file and the field. Before contacting the API, the seed checks that every referenced file exists and fails with the missing file names otherwise. Today 24 hotels carry a photo and 6 have none; those can be completed through the administrative panel. The seed photos are JPEGs about 900 pixels wide and between 150 and 260 KB.

An optional `ratings` list holds integer scores from 1 to 5, one per seed guest in order. Twenty hotels carry between two and six scores, with averages from about 1.5 to 5, and the other ten stay unrated. An optional `isActive` field sets the hotel state. Three unrated hotels without a photo, in different countries, declare `"isActive": false`: Aurea Hoi An Riverside, Aurea Arenal Cloud Forest and Aurea Vienna Secession. They are hidden from the public catalog. A hotel without the field keeps whatever state it has.

The seed goes through the public HTTP API, so the normal validation rules apply. It waits for `/health`, signs in with `ADMINISTRATOR_EMAIL` and `ADMINISTRATOR_PASSWORD`, which it receives from the same variables as the API and never prints, and then handles each hotel: it looks the name up with `GET /api/hotels?name=<name>` using the administrator token, compares the names exactly, and sends `POST /api/hotels` with the price and the discount only when the hotel is missing. When the hotel already exists, its `pricing` is `null` and the data file defines a price, the seed sends `PUT /api/hotels/{id}` with every field of that hotel from the data file, because the update replaces the whole details; a hotel whose pricing is already set is never touched, so prices changed through the panel are kept. The lookup uses the administrative list, which includes inactive hotels, so an inactive hotel is never created twice. The seed uploads each declared photo with `PUT /api/hotels/{id}/image` or `PUT /api/hotels/{id}/images/{position}` only when that position is empty.

After the hotels and photos, when `SEED_GUEST_PASSWORD` is set, the seed registers six guest accounts, `seed-guest-1@aurea.example` to `seed-guest-6@aurea.example`, through `POST /api/auth/register`. A `409` conflict means the account already exists and is accepted. Each guest then signs in through `POST /api/auth/login`. For every declared score, the seed reads the guest's own score with `GET /api/hotels/{id}/ratings/me` and sends `POST /api/hotels/{id}/ratings` only when the score differs. As the last step, the seed compares each declared `isActive` with the stored state and sends `PUT /api/hotels/{id}/status` with the administrator token only when they differ. The final line reports the hotels, guests, ratings sent, ratings unchanged and state changes.

Running it again therefore creates, updates, uploads, rates and changes nothing. Only a hotel renamed, deleted, left without pricing, photo or score, or set to another declared state through the API changes the outcome. If the API stays unavailable after the retry budget, a sign-in or registration is rejected, or a pricing update, upload, rating or state change is refused, the seed exits with a non-zero code. Its messages never include a password or a token.

Run it again without rebuilding with `docker compose --env-file .env.dev -f compose.dev.yaml up -d seed`. The seed is for development only and is not part of the production configuration. Its tests run with `python3 -I -m unittest discover -s docker/seed/tests -t docker/seed`.

Build the production image with `docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml build`. The production API waits for the database health check and for the migration, and the image directory is owned by the non-root runtime user. Missing secrets stop Compose with an error.

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

Implemented: `appsettings.json`, `appsettings.Development.json`, the development launch profile, the environment samples `.env.dev.example` and `.env.prod.example`, the authentication settings described in [Authentication](authentication.md) and the image directory described in [Hotel images](hotel-images.md). The Options Pattern is used for the JWT and the administrator bootstrap. Environment variables override ASP.NET Core configuration, using `__` for nesting (`ConnectionStrings__Hotels`, `Authentication__Jwt__SigningKey`). Secrets never enter Git.

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
| Backend persistence | xUnit against a real PostgreSQL 17 database (rows, constraints, concurrent ratings, concurrent image changes, upgrade of an existing schema) | Implemented |
| Backend image processing and storage | xUnit over real JPEG, PNG and WebP content: exact decoded equality, the 400,000 byte boundary, rejections and filesystem failures | Implemented |
| Backend application services | xUnit unit tests over the authentication use cases with in-memory doubles | Implemented |
| Backend HTTP and authorization | xUnit over the real server against a real PostgreSQL 17 database (endpoints, tokens, revocation, policies) | Implemented |
| Backend end-to-end | xUnit over the API started as a separate process and reached over a real socket, against an isolated PostgreSQL 17 database (ADR-014) | Implemented |
| Frontend | Component, form, service, interceptor, guard and filter tests, plus end-to-end tests for critical flows | Planned |
| Instructions | `node .pi/scripts/verify-instructions.mjs` structural check | Implemented |

The image tests create their own images and use unique temporary directories that they delete, so they need no fixture files and never touch the configured image directory. They do not assert exact compressed bytes, which vary across codec versions.

Persistence and HTTP tests need `HOTEL_TEST_CONNECTION` to point to a database named `hotels_test` on a disposable PostgreSQL 17 server. The suite creates and drops its own uniquely named database and fails, never skips, when the variable or server is missing:

```bash
HOTEL_TEST_CONNECTION='<connection string with Database=hotels_test>' dotnet test apps/api/tests/HotelManagement.Infrastructure.Tests
HOTEL_TEST_CONNECTION='<connection string with Database=hotels_test>' dotnet test apps/api/tests/HotelManagement.Api.Tests
HOTEL_TEST_CONNECTION='<connection string with Database=hotels_test>' dotnet test apps/api/tests/HotelManagement.E2E.Tests
```

The end-to-end suite starts the API as a separate process with `dotnet exec` over the built assembly, configured only through environment variables and with `ASPNETCORE_ENVIRONMENT=Production`. The server chooses its own loopback port and the suite reads the address it reports, so no port is reserved before the child binds it. The suite waits for `/health` before the first request, kills the process at the end and drops its database, and a startup that fails releases the process and the database before it reports the error. The inherited environment of the machine cannot alter that configuration, because every variable whose name matches one of the harness variables is removed before the child starts, including the variables written with the `DOTNET_` and the `ASPNETCORE_` prefixes that the host configuration reads. The secrets of the fixture reach the environment of the child process and are never printed, so the output of the process is redacted before it reaches a failure message. See [ADR-014](decisions/adr-014-end-to-end-tests-over-a-real-api-process.md).

The instruction validator checks structure only: required files, frontmatter, sections, links, ADR sections, absence of machine paths, obvious secrets and comment syntax in the script. It cannot prove that an agent followed the rules.

## Build and deployment

Implemented and verified: building with `dotnet build apps/api/HotelManagement.slnx`; the multi-stage API image builds, runs as a non-root user and serves `/health`; development Compose starts PostgreSQL and the API successfully. The runtime image was also exercised on `linux-arm64` with a fresh volume: the non-root user wrote, replaced and deleted images, and an image survived a restart. `linux-x64` is bundled by the package but was not exercised here. `dotnet publish` and the runtime image include `ThirdPartyNotices` next to the API with the unmodified third-party notices of Magick.NET. Deployment and the deployment target remain Planned.

## Working method

ODD (Organic Driven Development) as described in `AGENTS.md`: authorize scope, explore conventions, resolve real uncertainty, track substantial work, implement acceptance- and test-first where meaningful, then verify and close truthfully. Details in the agents page.
