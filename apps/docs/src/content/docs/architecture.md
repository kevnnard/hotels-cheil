---
title: Architecture
description: Layers, security model, image handling and implementation status.
---

The backend domain rules and PostgreSQL persistence layer are implemented; HTTP features, authentication and frontend remain planned. The status column states what is Implemented, Planned, Considered or Discarded.

## Monorepo

| Path | Purpose | Status |
|---|---|---|
| `apps/api` | ASP.NET Core modular monolith | Domain and persistence Implemented; HTTP/auth Planned |
| `apps/web` | Angular application | Planned |
| `apps/docs` | Astro Starlight documentation | Planned |
| `compose.yaml` | Container orchestration | API/PostgreSQL Implemented; web/docs Planned |

Applications stay independent. Documentation must not block the frontend or backend from running alone.

## Backend layers

| Project | Contains | May depend on |
|---|---|---|
| `HotelManagement.Domain` | Entities, value objects, enums, business rules, domain exceptions | Nothing |
| `HotelManagement.Application` | Use cases, application services, interfaces, DTOs, contracts, validations | Domain |
| `HotelManagement.Infrastructure` | EF Core, DbContext, migrations, persistence, file storage, image processing | Application, Domain |
| `HotelManagement.Api` | Controllers, middleware, authentication, policies, composition root, error handling | All, as composition root |

The four projects compile with these references. Domain contains hotel and rating rules; Application defines the targeted persistence contract; Infrastructure contains EF Core mappings, migrations and the PostgreSQL store. Api still maps only `/health` and does not wire persistence or authentication yet.

Backend style: modular monolith, application services instead of CQRS (ADR-003), PostgreSQL through Npgsql (ADR-002).

## Frontend areas

`core` (configuration, authentication, interceptors, guards), `shared` (generic components), `layouts` (public and administrative), `features` (Hotels, Admin, Auth). Native Angular state and HTTP (ADR-007).

## Authentication and RBAC

| Item | Status |
|---|---|
| Public catalog readable without authentication | Planned |
| Policies `hotels.read`, `hotels.create`, `hotels.update`, `hotels.delete` | Planned |
| Roles `Administrator` (manage hotels) and `User` (read) | Planned |
| Authentication transport | Pending decision |

Frontend guards are navigation only. The backend enforces authorization (ADR-004).

## Image management

| Item | Status |
|---|---|
| `IImageOptimizationService` and `IFileStorageService` as separate contracts | Planned |
| Content validation, resize, optimization, WebP when appropriate, result at most 400 KB | Planned |
| Local storage on a Docker volume | Planned |
| Cloudflare R2 | Considered for the future (ADR-006) |

Pending: allowed formats, input limits, maximum dimensions, the unit of 400 KB (400,000 or 409,600 bytes) and the image library.

## Other considered options

| Option | Status |
|---|---|
| MediatR and CQRS | Discarded for now (ADR-003) |
| SQL Server, SQLite | Discarded (ADR-002) |
| TanStack Query, NgRx | Discarded for now (ADR-007) |
| Angular Material | Considered only if a concrete, justified need appears (ADR-007) |
