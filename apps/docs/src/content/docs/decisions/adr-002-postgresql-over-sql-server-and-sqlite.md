---
title: ADR-002 PostgreSQL over SQL Server and SQLite
description: Decision to use PostgreSQL through Npgsql.
---

## Status

PostgreSQL 17 is the selected major (community support until November 2029). EF Core 10.0.13 with Npgsql provider 10.0.3 is used for persistence ([ADR-011](adr-011-postgresql-persistence.md)); covered by PostgreSQL integration tests. API wiring is Planned.

## Problem

A relational store is needed that runs in Docker, works locally, and behaves the same in tests and production.

## Alternatives considered

- SQL Server.
- SQLite.
- PostgreSQL.

## Decision

Use PostgreSQL through Npgsql. Do not assume SQLite behaves like PostgreSQL in tests.

## Justification

PostgreSQL runs in a container without licensing concerns, and testing against the real engine avoids behavior differences. PostgreSQL 17 is selected; a data volume must never be reused across major versions, so the Compose volume name carries the major (`postgres-17-data`).

## Advantages

- Same engine in development, tests and production.
- Open-source and container friendly.

## Disadvantages

- Heavier than SQLite for quick local runs.
- Requires a running server or container for integration tests.

## Consequences

Persistence tests prefer PostgreSQL containers when viable. Connection configuration comes from the environment and never from versioned secrets.

## Future improvements

Evaluate managed hosting once a deployment target is chosen.
