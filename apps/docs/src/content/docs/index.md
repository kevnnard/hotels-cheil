---
title: Hotel Management System
slug: overview
description: Introduction to the Hotel Management System documentation.
---

Hotel Management System is a full-stack application to administer and browse hotels, built as an interview validation exercise with delivery on 2026-10-28.

Mandatory requirements come first. Extras must not put functionality or delivery at risk.

## Current status

The agent instruction system, documentation skeleton, .NET 10 API skeleton, hotel/rating domain rules, PostgreSQL persistence layer, authentication and the hotel management endpoints exist. The API exposes `/health`, the authentication endpoints and the hotel CRUD, listing and rating endpoints. The documentation site, with its interactive architecture canvas, is Implemented; the frontend remains Planned; Docker Compose definitions and the API image are Implemented.

| Area | Scope | Status |
|---|---|---|
| Backend skeleton | Four-project solution, `/health` endpoint | Implemented |
| Backend | Domain rules and PostgreSQL persistence for hotels/ratings | Implemented |
| Backend | Identity, signed access tokens, revocable sessions and hotel policies | Implemented |
| Backend | Hotel CRUD over HTTP, filters, pagination and rating replacement | Implemented |
| Backend | Images optimized to at most 400 KB | Planned |
| Frontend | Landing page, public catalog, search and filters, admin panel, hotel CRUD, responsive design | Planned |
| Documentation | Astro Starlight site with the interactive architecture canvas | Implemented |
| Orchestration | Docker Compose plus manual execution | Backend API/PostgreSQL Implemented; web/docs Planned |

## Where to go next

- Architecture: layers, security model, images and the status of each capability.
- [Architecture map](/): interactive map of the layers, components, protocols and API contract.
- Development: requirements, installation, configuration, testing, build and deployment.
- Authentication: endpoints, configuration, sessions and policies.
- Hotel API: endpoints, filters, pagination, rating behavior and policies.
- Agents: how instructions and skills are loaded and verified.
- Decisions: ADR-001 to ADR-014.
