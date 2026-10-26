---
title: Hotel Management System
slug: overview
description: Introduction to the Hotel Management System documentation.
---

Hotel Management System is a full-stack application to administer and browse hotels, built as an interview validation exercise with delivery on 2026-10-28.

Mandatory requirements come first. Extras must not put functionality or delivery at risk.

## Current status

The whole system is Implemented and runs with one Docker Compose command or by hand: the ASP.NET Core API on PostgreSQL 17, the Angular web app with the public site and the admin panel, this documentation site with its interactive architecture map, and a development seed of 30 hotels. What a production deployment would still need is listed, as not implemented, in [Production considerations](production-considerations.md).

| Area | Scope | Status |
|---|---|---|
| Backend | Four-project solution, `/health`, domain rules and PostgreSQL persistence with migrations | Implemented |
| Backend | Identity, signed access tokens, revocable sessions, roles `Administrator` and `User`, policies | Implemented |
| Backend | Hotel CRUD, filters by name, minimum rating and maximum price, pagination, active state | Implemented |
| Backend | Ratings from 1 to 5, one per account and hotel, replaceable | Implemented |
| Backend | Optional nightly price and discount in USD | Implemented |
| Backend | Up to three lossless images per hotel within 400,000 bytes | Implemented |
| Backend | Anonymous read-only public catalogue under `/api/public/hotels` | Implemented |
| Frontend | Landing, catalogue with search and filters, hotel detail with gallery, visitor accounts and ratings | Implemented |
| Frontend | Admin login, directory with filters and paging, create and edit sheets, image slots, visibility switch | Implemented |
| Frontend | Responsive layout checked at 360, 390, 768 and 1280 px | Implemented |
| Frontend | Real booking | Not implemented; the reservation card is a demo |
| Documentation | Astro Starlight site with the interactive architecture map | Implemented |
| Orchestration | Docker Compose with db, migrator, api, web, docs and the development seed, plus manual execution | Implemented |
| Quality | Backend, web unit and component, Playwright and seed tests; coverage measured | Implemented |
| CI | GitHub Actions workflow for builds, lint, type checks and tests | Written, not yet run on GitHub |
| Production hardening | HTTPS, security headers, rate limiting, backups, monitoring and more | Planned or Considered, see Production considerations |

## Where to go next

- [Architecture map](/): interactive map of the layers, components, protocols and API contract.
- [Architecture](architecture.md): layers, security model, images and the status of each capability.
- [Development](development.md): requirements, installation, configuration, testing, build and deployment.
- [Authentication](authentication.md): endpoints, configuration, sessions and policies.
- [Hotel API](hotel-api.md): endpoints, filters, pagination, rating behavior and policies.
- [Hotel images](hotel-images.md): the images of a hotel, their limits, rejections and storage.
- [Hotel domain](hotel-domain.md): fields and validation rules of a hotel.
- [Production considerations](production-considerations.md): what a deployment needs beyond this exercise.
- [Agents](agents.md): how instructions and skills are loaded and verified.
- [Decisions](decisions/index.md): ADR-001 to ADR-021.
