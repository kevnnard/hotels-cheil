# Hotel Management System

A full-stack application to browse and administer the hotels of a fictitious chain, built as an interview validation exercise. It has an ASP.NET Core API (a modular monolith on PostgreSQL), an Angular web app with a public catalogue and an admin panel, and an Astro Starlight documentation site with an interactive architecture map. Docker Compose starts the whole system with one command, and every application can also run on its own without Docker.

## What it contains

| Application | Path | Stack |
|---|---|---|
| API | `apps/api` | .NET SDK 10.0.402 (`net10.0`), ASP.NET Core, EF Core 10.0.13 with Npgsql 10.0.3, ASP.NET Core Identity with JWT bearer tokens, Magick.NET-Q16-AnyCPU 15.0.0, xUnit 2.9.3 |
| Web | `apps/web` | Angular 22.2.3 (CLI 22.2.4), TypeScript 6.0.3, Tailwind CSS 4.3.3, Vitest 5.0.5 with `@vitest/coverage-v8` 5.0.5, Playwright 1.64.1, pnpm 12.15.0 |
| Docs | `apps/docs` | Astro 7.4.2, Starlight 0.42.7 |

Shared infrastructure: PostgreSQL 17, Node 26.12.1 in the container builds and CI, `nginxinc/nginx-unprivileged:1.30.6-alpine3.24` to serve the web and docs builds, and `python:3.13.9-alpine3.22` for the development seed.

## Features

### Public site

- Landing page and catalogue of active hotels with search by name, minimum rating and maximum nightly price, with paging.
- Hotel detail page with an image gallery of up to three photos, the nightly price in USD and the discounted price when there is one.
- Visitor registration and sign in; a signed-in visitor rates a hotel from 1 to 5 stars and can change the rating later.
- A reservation estimate card. It is a demo: it computes a total and sends nothing.
- Responsive layout, checked by Playwright at 360, 390, 768 and 1280 px.

### Admin panel

- Separate admin sign in at `/admin/login`, open only to the `Administrator` role.
- Hotel directory with filters and paging.
- Create and edit in a bottom sheet, with the edit form pre-filled and field errors from the API shown in the form.
- Three image slots per hotel, a visibility switch to hide a hotel from the public catalogue, and a rating control.
- Delete with confirmation.

### API

- Hotel CRUD with filters by name, minimum rating and maximum price, and pagination.
- Ratings from 1 to 5, one per account and hotel, replaceable, with `GET /api/hotels/{id}/ratings/me` for the caller's own score.
- Optional nightly price and discount percentage in USD.
- Up to three images per hotel, each kept within 400,000 bytes without quality loss and stored on a volume.
- Active or inactive state through `PUT /api/hotels/{id}/status`; inactive hotels are hidden from the public routes.
- ASP.NET Core Identity with signed access tokens and revocable sessions, the roles `Administrator` and `User`, and policy-based authorization.
- An anonymous, read-only public catalogue under `/api/public/hotels`.
- EF Core migrations applied by a one-shot migrator, never by the API at startup.

### Quality

- Backend suites for the domain, application, infrastructure, HTTP and end-to-end layers, with persistence and HTTP tests running against a real PostgreSQL.
- Web unit and component tests with coverage thresholds that fail the run.
- Playwright tests for the public catalogue, the responsive layout and the admin journey.
- Tests for the development seed.
- A GitHub Actions workflow for builds, lint, type checks and tests (written, not yet run on GitHub).

## Quickstart with Docker Compose

Prerequisites: Docker with the Compose plugin. Nothing else is needed on the host.

1. Create your environment file from the sample. Real environment files are ignored by Git; never commit secrets.

   ```bash
   cp .env.dev.example .env.dev
   ```

2. Fill these variables in `.env.dev`:

   | Variable | Value |
   |---|---|
   | `POSTGRES_PASSWORD` | A generated value, for example the output of `openssl rand -hex 24`. Letters and digits only, because Compose treats `$` specially. |
   | `ADMINISTRATOR_EMAIL` | The email of the first administrator, for example an address on `example.test`. |
   | `ADMINISTRATOR_PASSWORD` | A password of 8 to 128 characters with at least one letter and one digit. |
   | `SEED_GUEST_PASSWORD` | Optional. Same rules. When set, the seed creates six guest accounts and their ratings; when empty, it skips them. |

   The other variables already have working values. `JWT_SIGNING_KEY` is not needed in development: the API uses an ephemeral key.

3. Start the development stack with the seed:

   ```bash
   docker compose --env-file .env.dev -f compose.dev.yaml up --build
   ```

   The stack starts `db`, `migrator` (applies the migrations once and exits), `api` (with `dotnet watch`), `web`, `docs` and `seed` (loads 30 sample hotels once and exits). Every port is bound to `127.0.0.1`.

| Service | URL | Port variable |
|---|---|---|
| Web app | <http://localhost:4200> | `WEB_HTTP_PORT` (default 4200) |
| Admin panel | <http://localhost:4200/admin/login> | Same as the web app |
| API | <http://localhost:5080/health> | `API_HTTP_PORT` (default 5080) |
| Docs | <http://localhost:4321> | `DOCS_HTTP_PORT` (default 4321) |
| PostgreSQL | `localhost:5433` | `POSTGRES_HOST_PORT` (default 5433) |

The web container serves the Angular build with nginx and proxies `/api` to the API, so the browser talks to one origin.

Sign in to the admin panel at `/admin/login` with `ADMINISTRATOR_EMAIL` and `ADMINISTRATOR_PASSWORD`. The API creates that account with the `Administrator` role on every start if it does not exist. Visitors register at `/account/register`.

Stop the stack, or stop it and delete the database and the image volume:

```bash
docker compose --env-file .env.dev -f compose.dev.yaml down
docker compose --env-file .env.dev -f compose.dev.yaml down -v
```

Run the seed again without rebuilding with `docker compose --env-file .env.dev -f compose.dev.yaml up -d seed`. It is idempotent.

The production configuration is `compose.yaml` with `compose.prod.yaml` and `.env.prod` (from `.env.prod.example`, which also needs `JWT_SIGNING_KEY`). It uses the non-root runtime image of the API and publishes no PostgreSQL port. Check it with `docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml config`. Nothing is deployed.

## Quickstart manual

Prerequisites, as pinned in the repository:

| Tool | Version | Source |
|---|---|---|
| .NET SDK | 10.0.402, or a newer patch of the 10.0.4xx band | `apps/api/global.json` (`rollForward: latestPatch`) |
| Node | 26.12.1 | `apps/web/Dockerfile`, `apps/docs/Dockerfile`, `.github/workflows/ci.yml` |
| pnpm | 12.15.0 | `packageManager` in `apps/web/package.json` and the Dockerfiles |
| PostgreSQL | 17 | `postgres:17` in the Compose files |
| Python | 3, standard library only (the container uses 3.13.9) | Only for the seed |

Run every command from the repository root unless a `cd` is shown.

1. Load the environment into the shell. Create `.env.dev` as in the Docker quickstart first.

   ```bash
   set -a
   . ./.env.dev
   set +a
   export ConnectionStrings__Hotels="Host=localhost;Port=${POSTGRES_HOST_PORT};Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}"
   export Authentication__Administrator__Email="$ADMINISTRATOR_EMAIL"
   export Authentication__Administrator__Password="$ADMINISTRATOR_PASSWORD"
   ```

2. Start PostgreSQL 17. Any server works; this starts only the database container of the dev stack on port 5433:

   ```bash
   docker compose --env-file .env.dev -f compose.dev.yaml up -d db
   ```

3. Apply the migrations. The API never migrates at startup.

   ```bash
   cd apps/api
   dotnet tool restore
   dotnet ef database update --project src/HotelManagement.Infrastructure
   cd ../..
   ```

4. Run the API on <http://localhost:5080>. The `http` launch profile sets the JWT issuer and audience; in development the images go to a per-user directory unless `Storage__Images__RootPath` names another absolute directory.

   ```bash
   dotnet run --project apps/api/src/HotelManagement.Api --launch-profile http
   ```

5. Run the web app on <http://localhost:4200>. The dev server proxies `/api` to `http://127.0.0.1:5080` and listens on `localhost` only, so use `localhost` and not `127.0.0.1`.

   ```bash
   cd apps/web
   pnpm install
   pnpm start
   ```

6. Run the docs on <http://localhost:4321>. They need neither the API nor the database.

   ```bash
   cd apps/docs
   pnpm install
   pnpm run dev
   ```

7. Seed the sample hotels against the running API:

   ```bash
   API_BASE_URL=http://localhost:5080 SEED_IMAGES_DIR=docker/seed/images python3 docker/seed/seed_hotels.py
   ```

## Environment variables

Three samples are versioned: `.env.dev.example` for the development stack, `.env.prod.example` for the production configuration and `.env.example` with every variable the Compose files read. Copy a sample, fill it locally and never commit the copy. The placeholders below are examples, not real values.

| Name | Used by | Required | Example placeholder |
|---|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | migrator, api | Yes | `Development` |
| `POSTGRES_DB` | db, migrator, api | Yes | `hotels_dev` |
| `POSTGRES_USER` | db, migrator, api | Yes | `hotels_dev` |
| `POSTGRES_PASSWORD` | db, migrator, api | Yes | `<openssl rand -hex 24>` |
| `POSTGRES_HOST_PORT` | db (dev) | No | `5433` |
| `API_HTTP_PORT` | api | No | `5080` (dev), `8080` (prod) |
| `WEB_HTTP_PORT` | web | No | `4200` |
| `DOCS_HTTP_PORT` | docs | No | `4321` |
| `ADMINISTRATOR_EMAIL` | api, seed | Yes in dev and prod | `admin@example.test` |
| `ADMINISTRATOR_PASSWORD` | api, seed | Yes in dev and prod | `<8 to 128 characters with a letter and a digit>` |
| `SEED_GUEST_PASSWORD` | seed (dev) | No | `<8 to 128 characters with a letter and a digit>` |
| `JWT_SIGNING_KEY` | api | Yes in prod; ephemeral key in dev | `<openssl rand -base64 48>` |
| `JWT_ISSUER` | api | No | `hotels-api` |
| `JWT_AUDIENCE` | api | No | `hotels-api-clients` |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | api | No | `15` |
| `ConnectionStrings__Hotels` | API and migrations, manual run | Yes | `Host=localhost;Port=5433;Database=hotels_dev;Username=hotels_dev;Password=<password>` |
| `Storage__Images__RootPath` | API, manual run | Outside development | `<absolute directory outside the repository>` |
| `HOTEL_TEST_CONNECTION` | backend Infrastructure, Api and E2E tests | Yes for those suites | `Host=localhost;Port=5433;Database=hotels_test;Username=<user>;Password=<password>` |
| `BASE_URL` | Playwright | No | `http://localhost:4200` |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Playwright admin tests | Yes for those tests | The administrator of your `.env.dev` |
| `API_BASE_URL`, `SEED_IMAGES_DIR` | seed, manual run | No | `http://localhost:5080`, `docker/seed/images` |

Quotes in an env file: Compose strips the surrounding quotes of a value, and sourcing the file with `.` in a shell does too, but extracting a line with `cut` keeps them. Write values without quotes, or strip them when you read the file another way.

The API reads its own settings with `__` for nesting, so the Compose variables above are mapped to names such as `Authentication__Jwt__SigningKey` inside the Compose files. The full list is in the [Authentication](apps/docs/src/content/docs/authentication.md) and [Development](apps/docs/src/content/docs/development.md) pages.

## Testing

| Suite | Command | Tests | Needs |
|---|---|---|---|
| API domain | `dotnet test apps/api/tests/HotelManagement.Domain.Tests` | 163 | Nothing |
| API application | `dotnet test apps/api/tests/HotelManagement.Application.Tests` | 117 | Nothing |
| API infrastructure | `dotnet test apps/api/tests/HotelManagement.Infrastructure.Tests` | 197 | `HOTEL_TEST_CONNECTION` |
| API HTTP | `dotnet test apps/api/tests/HotelManagement.Api.Tests` | 177 | `HOTEL_TEST_CONNECTION` |
| API end-to-end | `dotnet test apps/api/tests/HotelManagement.E2E.Tests` | 46 | `HOTEL_TEST_CONNECTION` |
| Web unit and component | `pnpm test` in `apps/web` | 704 | Nothing |
| Web Playwright | `pnpm e2e` in `apps/web` | 57 | The running seeded stack and three variables |
| Seed | `python3 -I -m unittest discover -s docker/seed/tests -t docker/seed` | 55 | Nothing |

`HOTEL_TEST_CONNECTION` must point to a database named `hotels_test` on a disposable PostgreSQL 17 server. The suites create and drop their own uniquely named database, and fail rather than skip when the variable or the server is missing.

Playwright runs against the seeded development stack, because the public tests expect the 30 seed hotels. Start the stack, then from `apps/web`:

```bash
pnpm exec playwright install chromium
BASE_URL=http://localhost:4200 E2E_ADMIN_EMAIL="$ADMINISTRATOR_EMAIL" E2E_ADMIN_PASSWORD="$ADMINISTRATOR_PASSWORD" pnpm e2e
```

The projects are `desktop` (1280 px), `tablet` (768 px), `mobile-360` and `mobile-390`. The admin tests run on desktop and at 390 px. Without `BASE_URL` Playwright starts its own dev server on `127.0.0.1:4200`.

Coverage:

| Side | Command | Result |
|---|---|---|
| Web | `pnpm test:coverage` in `apps/web` | 98.31% of lines; fails below 95 lines, 90 branches, 94 functions, 95 statements. HTML in `apps/web/coverage/web/index.html`. |
| API domain | `dotnet test apps/api/tests/HotelManagement.Domain.Tests --collect:"XPlat Code Coverage"` | 99.08% of lines, measured only |
| API application | `dotnet test apps/api/tests/HotelManagement.Application.Tests --collect:"XPlat Code Coverage"` | 98.42% of lines, measured only |

The thresholds and their reasons are in [ADR-020](apps/docs/src/content/docs/decisions/adr-020-test-coverage.md).

Static checks: `pnpm lint` and `pnpm typecheck` in `apps/web`, `pnpm run check` in `apps/docs`, and `dotnet format apps/api/HotelManagement.slnx --verify-no-changes` for the API.

## Project structure

```text
apps/
  api/                    ASP.NET Core modular monolith
    src/
      HotelManagement.Domain/
      HotelManagement.Application/
      HotelManagement.Infrastructure/
      HotelManagement.Api/
    tests/                Domain, Application, Infrastructure, Api, E2E and shared test support
    Dockerfile            dev, migrator and non-root runtime stages
  web/                    Angular app
    src/app/              core, shared, layouts, features
    e2e/                  Playwright tests
    Dockerfile            Node build, unprivileged nginx runtime
  docs/                   Astro Starlight site
    src/content/docs/     Pages and ADRs
    src/data/architecture.ts   Model of the architecture map
    Dockerfile
docker/
  nginx/                  web.conf (with the /api proxy) and docs.conf
  seed/                   Development seed: hotels.json, photos, script and tests
.github/workflows/ci.yml  CI workflow
compose.yaml              Common services
compose.dev.yaml          Self-contained development stack with the seed
compose.prod.yaml         Production overlay
.env.example, .env.dev.example, .env.prod.example
```

## Architecture

- The API follows Clean Architecture: Domain depends on nothing, Application holds the use cases and ports, Infrastructure implements them with EF Core, Identity, Magick.NET and the filesystem, and Api hosts the controllers, policies and composition root.
- It is a modular monolith with application services, not CQRS or microservices.
- The Angular app is organized in `core`, `shared`, `layouts` and `features`, uses Signals and HttpClient, and never calls HTTP from presentation components. Guards only steer navigation; the API policies are the security boundary.
- The web and the API share one origin: the nginx container, or the Angular dev server, proxies `/api` to the API.
- The architecture map, served as the home page of the docs, is a hand-maintained model of the layers, components and endpoints. See [Architecture](apps/docs/src/content/docs/architecture.md) and the [decision records](apps/docs/src/content/docs/decisions/index.md).

## API overview

| Method | Route | Access |
|---|---|---|
| `GET` | `/health` | Anonymous |
| `POST` | `/api/auth/register`, `/api/auth/login` | Anonymous |
| `GET` | `/api/auth/me` | Any signed-in account |
| `POST` | `/api/auth/logout` | Any signed-in account |
| `GET` | `/api/public/hotels`, `/api/public/hotels/{id}` | Anonymous, active hotels only |
| `GET` | `/api/public/hotels/{id}/image`, `/api/public/hotels/{id}/images/{position}` | Anonymous, active hotels only |
| `GET` | `/api/hotels`, `/api/hotels/{id}` | `Administrator`, `User` (`hotels.read`) |
| `POST` | `/api/hotels` | `Administrator` (`hotels.create`) |
| `PUT` | `/api/hotels/{id}`, `/api/hotels/{id}/status` | `Administrator` (`hotels.update`) |
| `DELETE` | `/api/hotels/{id}` | `Administrator` (`hotels.delete`) |
| `POST` | `/api/hotels/{id}/ratings` | `Administrator`, `User` (`hotels.rate`) |
| `GET` | `/api/hotels/{id}/ratings/me` | `Administrator`, `User` (`hotels.rate`) |
| `PUT`, `DELETE` | `/api/hotels/{id}/images/{position}`, `/api/hotels/{id}/image` | `Administrator` (`hotels.update`) |
| `GET` | `/api/hotels/{id}/images/{position}`, `/api/hotels/{id}/image` | `Administrator`, `User` (`hotels.read`) |

List filters are `name`, `minRating`, `maxPrice`, `page` and `pageSize` (1 to 100, default 20). Positions are 0, 1 and 2, and `/image` is position 0. Full contract: [Hotel API](apps/docs/src/content/docs/hotel-api.md), [Hotel images](apps/docs/src/content/docs/hotel-images.md) and [Authentication](apps/docs/src/content/docs/authentication.md).

## CI

`.github/workflows/ci.yml` runs on every push and pull request with four jobs: `web` (install, lint, typecheck, coverage run, build), `docs` (check, build), `api` (Release build, `dotnet format --verify-no-changes`, every backend suite against a PostgreSQL 17 service) and `images` (builds the web, docs and API Dockerfiles). It does not deploy and does not run Playwright, which needs the full stack and the administrator credentials; run Playwright locally. The workflow is written and has not run on GitHub yet, because the repository has no remote. See [ADR-021](apps/docs/src/content/docs/decisions/adr-021-delivery-compose-and-ci.md).

## Production considerations

The exercise runs locally and leaves out what a real deployment needs. None of these is implemented:

- Rate limiting and lockout on login.
- Security headers, HSTS and HTTPS termination.
- An explicit CORS policy (none is needed today because the web and the API share an origin).
- Token refresh and httpOnly cookie sessions (the token lives in `sessionStorage`, see [ADR-019](apps/docs/src/content/docs/decisions/adr-019-admin-session-storage.md)).
- Secrets management beyond environment variables.
- Backups of the database and the image volume.
- Monitoring, logs and an image CDN.

The reasons and what each one would involve are in [Production considerations](apps/docs/src/content/docs/production-considerations.md).

## Known limitations

- The admin directory has no filter by active state.
- Six seed hotels have no photo: three visible and three inactive.
- No email verification or password reset.
- No real booking: the reservation card is a demo and sends nothing.
- The quote, suites, amenities and manager sections of the detail page are static sample content.
- The architecture map is maintained by hand, not generated from the code.

## Conventions

- No comments in code or configuration files; Markdown documentation is the place for explanations.
- Exact dependency versions, without ranges.
- Every relevant decision is recorded as an ADR in `apps/docs/src/content/docs/decisions/`, and the docs label each capability as Implemented, Planned, Considered or Discarded.
- Secrets never enter Git; only the `.env*.example` samples are versioned.
