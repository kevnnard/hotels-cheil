# Hotel Management System

Full-stack application to administer and browse hotels, built as an interview validation exercise. Delivery date: 2026-10-28.

Current status: the agent instruction system, documentation skeleton, .NET 10 API skeleton, hotel/rating domain rules, PostgreSQL persistence layer and authentication exist. The API exposes `/health` and the authentication endpoints; hotel CRUD over HTTP and the frontend remain planned.

## Quick path

1. Read [AGENTS.md](AGENTS.md), the shared rules for every agent.
2. Load the skill that matches your scope: `api` for the backend, `app` for the frontend.
3. Run `node .pi/scripts/verify-instructions.mjs` to check the instruction structure (Node built-ins only).

## Run the API

Requires .NET SDK 10.0.402 or a newer patch within the 10.0.4xx feature band (see [ADR-009](apps/docs/src/content/docs/decisions/adr-009-dotnet-10-sdk.md)). Run from the repository root:

```bash
dotnet restore apps/api/HotelManagement.slnx
dotnet build apps/api/HotelManagement.slnx
dotnet run --project apps/api/src/HotelManagement.Api --launch-profile http
```

For reload on changes use `dotnet watch --project apps/api/src/HotelManagement.Api --launch-profile http`.

Open <http://localhost:5080/health>. Expected response: status `200`, body `Healthy`. The profile is plain HTTP for local development only; there is no TLS. The API needs PostgreSQL and the authentication settings: export `ConnectionStrings__Hotels`, `Authentication__Jwt__Issuer` and `Authentication__Jwt__Audience`, apply the migrations and start the process. See [Development](apps/docs/src/content/docs/development.md) and [Authentication](apps/docs/src/content/docs/authentication.md). Docker Compose files and an API image are available and verified for development and production configuration.

## Status legend

| Label | Meaning |
|---|---|
| Implemented | Exists in the repository and was verified |
| Planned | Decided, not yet built |
| Considered | Evaluated, no decision yet |
| Discarded | Evaluated and rejected |

## What exists

| Item | Status |
|---|---|
| `AGENTS.md`, `.pi/APPEND_SYSTEM.md`, skills `api` and `app` | Implemented |
| Structural validator `.pi/scripts/verify-instructions.mjs` | Implemented |
| Documentation skeleton and ADRs (content only, no Starlight project) | Implemented |
| `apps/api` four-project skeleton with `/health` and pinned .NET 10 SDK | Implemented |
| `apps/api` hotel domain rules and PostgreSQL persistence | Implemented |
| `apps/api` authentication, sessions and authorization policies | Implemented |
| `apps/api` hotel HTTP features | Planned |
| `apps/web` Angular application | Planned |
| `apps/docs` Astro Starlight project | Planned |
| `compose.yaml`, development/production variants, API Dockerfile and environment samples | Implemented |

## Target structure

```text
apps/
  api/
  web/
  docs/
docker/
compose.yaml
.env.example
README.md
```

## Documentation map

Pages live in `apps/docs/src/content/docs/` so a Starlight project can adopt them without moving files.

- [Introduction](apps/docs/src/content/docs/index.md)
- [Architecture](apps/docs/src/content/docs/architecture.md)
- [Development, configuration, testing and deployment](apps/docs/src/content/docs/development.md)
- [Authentication, sessions and policies](apps/docs/src/content/docs/authentication.md)
- [Working with agents](apps/docs/src/content/docs/agents.md)

Architecture decision records:

- [ADR-001 Clean Architecture](apps/docs/src/content/docs/decisions/adr-001-clean-architecture.md)
- [ADR-002 PostgreSQL over SQL Server and SQLite](apps/docs/src/content/docs/decisions/adr-002-postgresql-over-sql-server-and-sqlite.md)
- [ADR-003 Application services over CQRS](apps/docs/src/content/docs/decisions/adr-003-application-services-over-cqrs.md)
- [ADR-004 RBAC through policies](apps/docs/src/content/docs/decisions/adr-004-rbac-through-policies.md)
- [ADR-005 Docker Compose and manual execution](apps/docs/src/content/docs/decisions/adr-005-docker-compose-and-manual-execution.md)
- [ADR-006 Local storage over Cloudflare R2](apps/docs/src/content/docs/decisions/adr-006-local-storage-over-cloudflare-r2.md)
- [ADR-007 Native Angular over TanStack Query](apps/docs/src/content/docs/decisions/adr-007-native-angular-over-tanstack-query.md)
- [ADR-008 Monorepo with independent applications](apps/docs/src/content/docs/decisions/adr-008-monorepo-with-independent-applications.md)
- [ADR-009 .NET 10 SDK](apps/docs/src/content/docs/decisions/adr-009-dotnet-10-sdk.md)
- [ADR-010 User scores and one replaceable rating per user](apps/docs/src/content/docs/decisions/adr-010-hotel-scores.md)
- [ADR-011 PostgreSQL persistence for hotels and ratings](apps/docs/src/content/docs/decisions/adr-011-postgresql-persistence.md)
- [ADR-012 Identity, JWT and revocable sessions](apps/docs/src/content/docs/decisions/adr-012-identity-jwt-and-revocable-sessions.md)

## Pending decisions

Versions (Angular, Node, Tailwind, Starlight), allowed image formats and limits and the unit of "400 KB". See [Working with agents](apps/docs/src/content/docs/agents.md).
