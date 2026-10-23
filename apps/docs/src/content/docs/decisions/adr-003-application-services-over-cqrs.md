---
title: ADR-003 Application services over CQRS
description: Decision to use traditional application services and no MediatR initially.
---

## Status

Planned.

## Problem

The hotel domain is small, and the delivery window is short.

## Alternatives considered

- CQRS with MediatR handlers per command and query.
- Traditional application services with explicit contracts.

## Decision

Use traditional application services with explicit contracts. Do not use CQRS or MediatR initially.

## Justification

Current domain complexity does not justify a handler per command and query. Fewer moving parts reduce delivery risk.

## Advantages

- Less code and indirection.
- Simple to read and test.

## Disadvantages

- Services can grow large if not kept cohesive.
- Moving to CQRS later costs some refactoring.

## Consequences

Services stay small and cohesive; god services are not accepted. Contracts remain explicit so evolution does not require rewriting the domain.

## Future improvements

Adopt handlers where read and write models genuinely diverge.
