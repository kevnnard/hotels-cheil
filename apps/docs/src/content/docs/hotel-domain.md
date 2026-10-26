---
title: Hotel domain rules
description: Fields, limits and validation rules enforced by the hotel domain model in HotelManagement.Domain.
---

## Status

Implemented in `HotelManagement.Domain` as pure domain rules with unit tests. The HTTP contract that applies them is in [Hotel API](/hotel-api/), and the database adds its own column sizes and checks as a second guard (ADR-011). Hotel ratings are covered by [ADR-010](/decisions/adr-010-hotel-scores/), the optional nightly price and discount by [ADR-018](/decisions/adr-018-nightly-price-and-discount/) and the image positions by [ADR-017](/decisions/adr-017-up-to-three-images-per-hotel/).

## Fields

| Field | Required | Max length |
|---|---|---|
| Name | Yes | 200 |
| Description | No | 2000 |
| Street | No | 200 |
| City | No | 100 |
| Region | No | 100 |
| Country | No | 100 |
| Postal code | No | 20 |
| Phone | No | 30 |
| Email | No | 254 |
| Website | No | 2048 |

Only the name is mandatory. The name is not required to be unique.

## Text handling

- Values are trimmed before the length check, so the limit applies to the trimmed text.
- A blank optional value becomes `null`.
- A missing or blank name is rejected.
- Any violation throws `DomainValidationException`.

## Contact format

| Field | Rule |
|---|---|
| Email | No whitespace, exactly one `@`, a non-empty part before it, and a domain with a dot that neither starts nor ends with a dot. This is a basic check, not full RFC validation. |
| Website | Absolute URL with the `http` or `https` scheme. Other schemes and values without a scheme are rejected. |
| Phone | Free text within the length limit. No format is checked. |

## Identity, state and time

- A new hotel gets a generated identifier and starts active.
- Creation and update times are passed in by the caller and must be UTC; any other kind is rejected and the hotel is left unchanged.
- Creating sets both timestamps to the supplied time. Updating details sets only the update time.
- Changing the active state to the value it already has does nothing, including the update time.
