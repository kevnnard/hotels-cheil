---
title: ADR-007 Native Angular over TanStack Query
description: Decision to use Signals and HttpClient instead of TanStack Query or NgRx.
---

## Status

Planned.

## Problem

The frontend needs remote state handling, with minimal dependencies and delivery risk.

## Alternatives considered

- TanStack Query.
- NgRx.
- Angular Signals with HttpClient.

## Decision

Use Angular Signals and HttpClient. Do not introduce TanStack Query or NgRx initially. Do not introduce Angular Material unless a concrete, justified need exists.

## Justification

Native capabilities cover the current needs, and each library would need a dependency review under the dependency policy.

## Advantages

- Fewer dependencies.
- Less to learn and maintain.

## Disadvantages

- Caching and refetch logic is written by hand.
- Possible duplication across features.

## Consequences

Remote, feature, derived and local state stay separated. Any library is added only with a written justification.

## Future improvements

Reconsider if caching and synchronization become complex.

## Considerations

No browser client exists yet, so the architecture canvas models only the implemented API, its layers, PostgreSQL and Docker. A browser client, and with it a public read-only catalog, would be decided when the work starts. Every current hotel route requires a valid token, so anonymous reads would need a deliberate change to the authorization policies and an update to the API contract. Reconsider this ADR and add the client to the canvas only when that client is built. This is a consideration, not a commitment.
