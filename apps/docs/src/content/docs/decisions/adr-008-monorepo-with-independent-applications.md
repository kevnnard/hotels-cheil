---
title: ADR-008 Monorepo with independent applications
description: Decision to keep api, web and docs in one repository as independent applications.
---

## Status

Implemented. `apps/api`, `apps/web` and `apps/docs` exist, each with its own toolchain, Dockerfile and tests, and each runs on its own.

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

## Considerations

The architecture canvas shows only what is built, and the web application is now part of it. Reconsider shared tooling only if two or more applications duplicate the same configuration. This is a consideration, not a commitment.
