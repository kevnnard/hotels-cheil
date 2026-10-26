---
title: ADR-010 Hotel scores and one rating per user
description: Decision to model user scores from 1 to 5 as a rule separate from official stars, with one replaceable rating per user and hotel.
---

## Status

Domain rule Implemented in `HotelManagement.Domain` with unit tests. Persistence, the uniqueness constraint and atomic writes are Implemented and tested against PostgreSQL ([ADR-011](adr-011-postgresql-persistence.md)). HTTP exposure is Implemented: the rating write and the read of the own score ([ADR-013](adr-013-hotel-http-contract.md)).

## Problem

Users must be able to rate hotels from 1 to 5, and a user who rates again must not add another vote. A hotel's official star classification is a different concept and must not be mixed with user opinion.

## Alternatives considered

- Reuse an official star field as the rating.
- Reject a second rating from the same user.
- Replace the user's previous rating.
- Store a running average and counter on the hotel.

## Decision

- A score is a user opinion. Official stars are a separate attribute and are not modeled here.
- A score is a decimal in the inclusive range 1 to 5. Integer-only was not requested, so it is not enforced.
- One user has at most one score per hotel. A repeated rating replaces the previous score and does not change the count.
- The summary is derived from sum and count. The average is `null` when the count is 0 and is not rounded.
- Invalid input throws a domain validation exception and leaves the existing scores unchanged.

## Justification

Replacing the vote matches the answer given for the repeat-rating question and keeps the count equal to the number of distinct users. Deriving the average from sum and count gives one calculation that a database projection can feed later, with no stored counters that could drift.

## Advantages

- One authoritative calculation: `RatingSummary.From(sum, count)`.
- Exact decimal arithmetic; presentation rounding is left to consumers.
- No shared mutable state or locks in the domain.

## Disadvantages

- `HotelRatings` holds votes in memory, so it models the rule but is not how production storage will count votes.
- Decimal scores allow values such as 3.5, which the product may later restrict.

## Consequences

The domain does not guarantee uniqueness or atomicity across requests. Those guarantees depend on a PostgreSQL unique constraint on the hotel and user pair and on atomic writes. Both are enforced and tested in persistence (ADR-011); they are not exposed over HTTP yet.

## Addendum: reading the own score

The rule is unchanged. A signed-in account can read its own current score for a hotel through `GET /api/hotels/{id}/ratings/me` (ADR-013), so the interface can show and replace the vote after a reload. The read returns only the score of the caller, or `null` when there is none, and reads the existing `hotel_ratings` row by its hotel and user key; no table or migration was added.

## Related

Hotel field limits and format rules are documented in [Hotel domain rules](../hotel-domain.md).

## Future improvements

- Add official stars as a separate hotel attribute if required.
- Revisit integer-only scores if the product asks for them.
