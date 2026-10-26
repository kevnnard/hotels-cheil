---
title: Architecture
description: Layers, security model, image handling and implementation status.
---

The API, the Angular web app, the documentation site and the Docker Compose stack are implemented. The status column states what is Implemented, Planned, Considered or Discarded; what a deployment would still need is in [Production considerations](production-considerations.md).

## Monorepo

| Path | Purpose | Status |
|---|---|---|
| `apps/api` | ASP.NET Core modular monolith | Implemented: domain, persistence, authentication, hotel endpoints, public catalogue, ratings, pricing and images |
| `apps/web` | Angular application: public site, visitor accounts and admin panel | Implemented |
| `apps/docs` | Astro Starlight documentation with the interactive architecture canvas | Implemented |
| `compose.yaml`, `compose.dev.yaml`, `compose.prod.yaml` | Container orchestration: db, migrator, api, web and docs, plus the seed in development | Implemented (ADR-005, ADR-021) |
| `.github/workflows/ci.yml` | Builds, lint, type checks, tests and image builds | Written, not yet run on GitHub (ADR-021) |

Applications stay independent. Documentation must not block the frontend or backend from running alone.

## Architecture canvas

The [architecture canvas](/), which is the home page of the site, draws the layers, the components inside them, the protocols between them, the API endpoints with the policy each one requires and the path of a request from the client to the database. Selecting a component shows what it does, what the system expects from it and where its data lives. Its content lives in `apps/docs/src/data/architecture.ts`, so keeping it current means editing that model. Run the site as described in [Development](development.md).

## Backend layers

| Project | Contains | May depend on |
|---|---|---|
| `HotelManagement.Domain` | Entities, value objects, enums, business rules, domain exceptions | Nothing |
| `HotelManagement.Application` | Use cases, application services, interfaces, DTOs, contracts, validations | Domain |
| `HotelManagement.Infrastructure` | EF Core, DbContext, migrations, persistence, file storage, image processing | Application, Domain |
| `HotelManagement.Api` | Controllers, middleware, authentication, policies, composition root, error handling | All, as composition root |

The four projects compile with these references. Domain contains hotel and rating rules; Application defines the targeted persistence contract and the authentication use cases; Infrastructure contains EF Core mappings, migrations, the PostgreSQL store, Identity and the session store; Api hosts the authentication endpoints, the token issuer, the policies and the composition root.

Backend style: modular monolith, application services instead of CQRS (ADR-003), PostgreSQL through Npgsql (ADR-002).

## Frontend areas

`core` (configuration, authentication, interceptors, guards), `shared` (generic components), `layouts` (public and administrative), `features` (hotels, account, auth, admin). Native Angular state and HTTP (ADR-007). Implemented (ADR-016).

The browser calls `/api` on its own origin. In Compose the nginx container of the web app proxies `/api` to the API; in development the Angular dev server does the same with `proxy.conf.json`. No CORS policy is needed (ADR-021).

## Authentication and RBAC

| Item | Status |
|---|---|
| Public catalog readable without authentication, under `/api/public/hotels` | Implemented |
| Policies `hotels.read`, `hotels.create`, `hotels.update`, `hotels.delete`, `hotels.rate` | Implemented |
| Roles `Administrator` (manage hotels) and `User` (read and rate) | Implemented |
| Authentication transport | Identity with signed access tokens and revocable sessions (ADR-012) |
| Registration, sign in, signed-in account and logout endpoints | Implemented |
| First administrator provisioned from the environment | Implemented |
| Hotel CRUD, listing with filters and pagination, active state, and rating endpoints | Implemented (ADR-013) |
| Visitor registration and sign in in the web app, token in `sessionStorage` | Implemented (ADR-019) |
| Login rate limiting, lockout, token refresh, cookie sessions | Not implemented; see Production considerations |

The public catalogue serves active hotels only and has no policy; every route under `/api/hotels` requires a token.

Frontend guards are navigation only. The backend enforces authorization (ADR-004).

## Image management

| Item | Status |
|---|---|
| `IImageOptimizationService` and `IFileStorageService` as separate contracts | Implemented |
| Content validation, strict lossless verification, result at most 400,000 bytes | Implemented (ADR-015) |
| Up to three images per hotel in positions 0 to 2, with upload, read, replace and remove endpoints | Implemented (ADR-017) |
| Local storage on a Docker volume with generated keys and staged writes | Implemented |
| Resize, lossy conversion | Discarded for this scope (ADR-015) |
| Cloudflare R2 | Considered for the future (ADR-006) |

Rules, limits, failure behavior and operation are in [Hotel images](hotel-images.md).

## Other considered options

| Option | Status |
|---|---|
| MediatR and CQRS | Discarded for now (ADR-003) |
| SQL Server, SQLite | Discarded (ADR-002) |
| TanStack Query, NgRx | Discarded for now (ADR-007) |
| Angular Material | Considered only if a concrete, justified need appears (ADR-007) |
