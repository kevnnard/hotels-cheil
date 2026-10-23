---
title: ADR-008 Monorepo with independent applications
description: Decision to keep api, web and docs in one repository as independent applications.
---

## Status

Planned. Only the agent instructions exist.

## Problem

Three deliverables must be reviewed together, but documentation must not block the frontend or backend.

## Alternatives considered

- One repository per application.
- A monorepo with shared build tooling.
- A monorepo with independent applications.

## Decision

Use a monorepo with apps/api, apps/web and apps/docs, each buildable and runnable on its own.

## Justification

A single repository simplifies review and agent instructions, while independence keeps failures isolated.

## Advantages

- One place for instructions and documentation.
- Applications run alone.

## Disadvantages

- Mixed toolchains in one repository.
- Shared tooling is not available.

## Consequences

No shared build tooling is introduced initially. Each application owns its configuration and tests.

## Future improvements

Add workspace tooling if duplication becomes costly.
