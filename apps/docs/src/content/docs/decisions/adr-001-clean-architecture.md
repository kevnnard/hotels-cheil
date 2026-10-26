---
title: ADR-001 Clean Architecture
description: Decision to separate the backend and frontend into layers with inward dependencies.
---

## Status

Implemented. The API has the four projects Domain, Application, Infrastructure and Api with inward references, and the Angular app is organized in `core`, `shared`, `layouts` and `features`.

## Problem

The application must stay maintainable and testable within a short delivery window, and business rules must not depend on the web framework or the database.

## Alternatives considered

- Single project with folders.
- Classic N-tier with the data layer at the bottom.
- Clean Architecture with four backend projects.

## Decision

Use Clean Architecture with the projects Domain, Application, Infrastructure and Api, with dependencies pointing inward. The frontend applies an adapted version organized by feature.

## Justification

Inward dependencies keep rules independent of EF Core and ASP.NET Core and allow testing without infrastructure.

## Advantages

- Testable business rules.
- Replaceable infrastructure such as storage.
- Clear review boundaries for agents.

## Disadvantages

- More projects and wiring than a small CRUD strictly needs.
- Risk of ceremony without value.

## Consequences

Each layer needs explicit contracts and tests. Abstractions are added only for a concrete reason. Architecture changes require a documented decision.

## Future improvements

Revisit the number of projects if the modules stay trivial.
