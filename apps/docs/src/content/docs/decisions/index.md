---
title: Architecture decisions
description: Index of architecture decision records and their status.
---

Each record states problem, alternatives, decision, justification, advantages, disadvantages, consequences and future improvements.

| Record | Topic | Status |
|---|---|---|
| ADR-001 | Clean Architecture | Implemented in the four API projects and the Angular feature areas |
| ADR-002 | PostgreSQL over SQL Server and SQLite | Implemented for backend persistence |
| ADR-003 | Application services over CQRS | Implemented |
| ADR-004 | RBAC through policies | Implemented for the API policies |
| ADR-005 | Docker Compose and manual execution | Implemented for db, migrator, api, web, docs and the dev seed; not deployed |
| ADR-006 | Local storage over Cloudflare R2 | Local storage Implemented, R2 Considered |
| ADR-007 | Native Angular over TanStack Query | Implemented |
| ADR-008 | Monorepo with independent applications | Implemented |
| ADR-009 | .NET 10 SDK | Implemented for the API and its images |
| ADR-010 | User scores and one replaceable rating per user | Implemented |
| ADR-011 | PostgreSQL persistence for hotels and ratings | Implemented and tested |
| ADR-012 | Identity, JWT and revocable sessions | Implemented and tested |
| ADR-013 | Hotel HTTP contract for CRUD, filters, pagination and ratings | Implemented |
| ADR-014 | End-to-end tests over a real API process | Implemented |
| ADR-015 | Strict lossless hotel images with Magick.NET | Implemented and tested |
| ADR-016 | Angular frontend stack with exact pins | Implemented, TypeScript 7 Considered |
| ADR-017 | Up to three images per hotel | Implemented and tested |
| ADR-018 | Optional nightly price and discount in USD | Implemented and tested in the API, the seed and the web app |
| ADR-019 | Admin session storage in sessionStorage, restore through /api/auth/me and 401 sign out | Implemented and tested in the web client |
| ADR-020 | Test coverage measurement and thresholds | Web measurement and thresholds Implemented, API measurement for Domain and Application Implemented, API enforcement Planned |
| ADR-021 | Delivery with Docker Compose and a CI workflow | Images, proxy and Compose Implemented; workflow written, not yet run on GitHub; image publishing and deployment Considered |
