---
title: Architecture decisions
description: Index of architecture decision records and their status.
---

Each record states problem, alternatives, decision, justification, advantages, disadvantages, consequences and future improvements.

| Record | Topic | Status |
|---|---|---|
| ADR-001 | Clean Architecture | Planned |
| ADR-002 | PostgreSQL over SQL Server and SQLite | Implemented for backend persistence |
| ADR-003 | Application services over CQRS | Planned |
| ADR-004 | RBAC through policies | Implemented for the API policies |
| ADR-005 | Docker Compose and manual execution | Planned |
| ADR-006 | Local storage over Cloudflare R2 | Local storage Implemented, R2 Considered |
| ADR-007 | Native Angular over TanStack Query | Planned |
| ADR-008 | Monorepo with independent applications | Planned |
| ADR-009 | .NET 10 SDK | Implemented for the API skeleton |
| ADR-010 | User scores and one replaceable rating per user | Implemented |
| ADR-011 | PostgreSQL persistence for hotels and ratings | Implemented and tested |
| ADR-012 | Identity, JWT and revocable sessions | Implemented and tested |
| ADR-013 | Hotel HTTP contract for CRUD, filters, pagination and ratings | Implemented |
| ADR-014 | End-to-end tests over a real API process | Implemented |
| ADR-015 | Strict lossless hotel images with Magick.NET | Implemented and tested |
| ADR-016 | Angular frontend stack with exact pins | Foundation Implemented, screens Planned, TypeScript 7 Considered |
| ADR-017 | Up to three images per hotel | Implemented and tested |
| ADR-018 | Optional nightly price and discount in USD | Implemented and tested in the API and the seed, web screens Planned |
| ADR-019 | Admin session storage in sessionStorage, restore through /api/auth/me and 401 sign out | Implemented and tested in the web client |
