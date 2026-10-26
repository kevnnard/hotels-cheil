---
title: ADR-007 Native Angular over TanStack Query
description: Decision to use Signals and HttpClient instead of TanStack Query or NgRx.
---

## Status

Implemented. The web app uses Signals, HttpClient, Reactive Forms and the Angular Router; TanStack Query, NgRx and Angular Material are not installed.

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

The browser client now exists and the architecture canvas models its routes, services, interceptor and guards. The anonymous catalog was added as separate read-only routes under `/api/public/hotels`, so the authorization policies of the administrative routes did not change. Reconsider a query library only if caching and synchronization across screens become complex. This is a consideration, not a commitment.
