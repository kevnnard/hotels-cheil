---
title: ADR-011 PostgreSQL persistence for hotels and ratings
description: Decision to persist hotels and one rating per user and hotel with EF Core, a targeted store contract and database-enforced invariants.
---

## Status

Implemented and tested: mappings, migration and store pass 28 integration tests against a real PostgreSQL 17 database (rows, constraints, concurrent same-user ratings). The migration command was applied to an isolated database, Compose configuration and image startup were verified, and the runtime image serves `/health` as a non-root user. The API wiring and the authentication built on this persistence are Implemented and recorded in ADR-012 and ADR-013.

## Problem

Hotels and ratings must survive restarts, one user must never hold two ratings for a hotel even under simultaneous requests, and the average must come from stored votes without drifting counters.

## Alternatives considered

- A generic repository over EF Core.
- Business-specific store contract in Application, implemented in Infrastructure.
- Stored average and count columns on the hotel.
- Integer-only or one-decimal rating precision.
- Read-then-write in application code to update a rating.

## Decision

- `IHotelStore` in `HotelManagement.Application/Persistence` exposes hotel add, find, update and delete. `IHotelRatingsStore` exposes rating summary and rate. Both carry no EF types, and the split follows the two aggregates of the domain.
- `PostgresHotelStore` and `PostgresHotelRatingStore` in Infrastructure implement them. Persistence entities are internal records mapped to and from the Domain model; `Hotel.Restore` rebuilds stored hotels with validation.
- `hotel_ratings` has the primary key `(hotel_id, user_id)`, a check constraint `score >= 1 AND score <= 5`, and a required foreign key to `hotels` with cascade delete. Deleting a hotel deletes its ratings; the hotel owns them.
- `score` is unconstrained `numeric`, so valid decimals between 1 and 5 are never rounded by the database.
- Rating writes use `INSERT ... ON CONFLICT (hotel_id, user_id) DO UPDATE`, one atomic statement. A repeated or changed vote replaces the previous one.
- The summary is the SQL `SUM` and `COUNT` of stored rows passed to `RatingSummary.From`, the single calculation contract shared with the Domain.
- The store takes a user identifier from the caller and rejects an empty one. Deriving it from validated claims belongs to T3 and T4.
- Connection strings come from `ConnectionStrings__Hotels`. There is no default value or password.

## Justification

Each persistence operation has a domain meaning, so a targeted contract is justified under the backend rules; a generic repository would add nothing. Letting PostgreSQL arbitrate concurrent writes removes the race that a read-then-write approach would have.

## Advantages

- Uniqueness, range and referential integrity hold regardless of which code path writes.
- No counters to keep consistent.
- Application and Domain stay free of EF Core.

## Disadvantages

- Raw SQL for the upsert ties that statement to PostgreSQL.
- Mapping between records and Domain objects is explicit code to maintain.
- Aggregating on every read costs more than a stored counter; acceptable at the current scale.

## Consequences

- Name uniqueness is not enforced for hotels.
- The user identifier has no foreign key yet; T3 adds Identity and the key if needed.
- Listing and filtering by name and rating are added with the T4 application services.

## Future improvements

- Add a user foreign key when Identity exists.
- Materialize or cache aggregates only if measurements show a need.
- Wire `AddHotelPersistence` into the API composition root.
