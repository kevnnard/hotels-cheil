---
title: Hotel Management System
description: Introduction to the Hotel Management System documentation.
---

Hotel Management System is a full-stack application to administer and browse hotels, built as an interview validation exercise with delivery on 2026-10-28.

Mandatory requirements come first. Extras must not put functionality or delivery at risk.

## Current status

The agent instruction system, documentation skeleton, .NET 10 API skeleton, hotel/rating domain rules and PostgreSQL persistence layer exist. The API still exposes only a `/health` endpoint. HTTP hotel features, authentication, frontend and the runnable documentation site remain Planned; Docker Compose definitions and the API image are Implemented.

| Area | Scope | Status |
|---|---|---|
| Backend skeleton | Four-project solution, `/health` endpoint | Implemented |
| Backend | Domain rules and PostgreSQL persistence for hotels/ratings | Implemented |
| Backend | Hotel CRUD over HTTP, authentication/RBAC, filters and images optimized to at most 400 KB | Planned |
| Frontend | Landing page, public catalog, search and filters, admin panel, hotel CRUD, responsive design | Planned |
| Documentation | Astro Starlight site | Planned |
| Orchestration | Docker Compose plus manual execution | Backend API/PostgreSQL Implemented; web/docs Planned |

## Where to go next

- Architecture: layers, security model, images and the status of each capability.
- Development: requirements, installation, configuration, testing, build and deployment.
- Agents: how instructions and skills are loaded and verified.
- Decisions: ADR-001 to ADR-011.
