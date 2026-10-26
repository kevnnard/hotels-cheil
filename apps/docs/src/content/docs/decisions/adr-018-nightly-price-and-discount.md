---
title: ADR-018 Nightly price and discount
description: Decision to give each hotel an optional nightly price and an optional discount percentage in a fixed USD currency, validated in the domain, stored in two nullable columns and filtered by an optional maximum price.
---

## Status

Implemented and tested in the API, the development seed and the Angular app: the catalogue cards and the detail page show the nightly and discounted prices, the public and admin filters send `maxPrice`, and the admin form edits the price and the discount.

## Problem

The catalogue shows hotels without any price, and its filter panel already has a price slider that does nothing. The project owner asked for a nightly price and a discount percentage in a fixed currency. The API must accept, validate, store and return them, and let clients filter by price, without breaking the existing clients, the existing hotels or the stored data.

## Decision

| Topic | Decision |
|---|---|
| Fields | An optional nightly price and an optional discount percentage, decided by the project owner. The currency is USD, fixed for every hotel and not stored. |
| Rules | The price is a decimal greater than 0, at most 100000, with at most two decimals. The discount is an integer from 1 to 90 and is accepted only when the hotel has a price. A discount without a price is a validation error. |
| Discounted rate | The domain computes `price * (100 - discount) / 100` rounded to two decimals, with halves rounded away from zero. It is returned on every read and never stored. |
| Layers | `HotelPricing` in the domain owns the rules and the computation and raises `DomainValidationException`, like the other hotel details. The application maps an error to the field `pricePerNight` or `discountPercent`, checked after the name. EF Core stays in Infrastructure. |
| Contracts | The create and update bodies gain the flat optional `pricePerNight` and `discountPercent`. Every hotel response gains `pricing`: `null` without a price, otherwise `currency`, `nightlyRate`, `discountPercent` and `discountedNightlyRate`, the last two `null` without a discount. `PUT` keeps replacing the whole details, so omitting both fields clears the pricing. |
| Filter | `GET /api/hotels` and `GET /api/public/hotels` accept an optional `maxPrice` greater than 0. It keeps the hotels whose effective nightly price (the discounted rate when there is a discount, otherwise the nightly rate) is at most the value; hotels without a price never match. It combines with `name` and `minRating` with AND semantics and runs in the SQL query before the count and the page. Zero, a negative value or a value that is not a number answers `400` with the usual validation problem. |
| Storage | Two nullable columns on `hotels`: `price_per_night numeric(10,2)` and `discount_percent smallint`, with three checks. |

## Alternatives considered

| Alternative | Why not |
|---|---|
| A currency column per hotel | Not required. Mixed currencies would need exchange rates for the filter and the ordering, and a stored value that is always `USD` adds nothing. |
| Storing the discounted rate | It can drift from the price and the discount. Computing it from two stored values keeps one source of truth; the filter repeats the same formula in SQL. |
| A separate pricing table or rate plans per date | Not required. One nightly price per hotel matches the catalogue and keeps the change additive. |
| A nested `pricing` object in the request bodies | The other optional fields are flat, and the clients already send flat bodies. The response groups the values because it adds the currency and the computed rate. |
| Filtering in memory after the page is read | Wrong totals and pages, and every hotel would have to be loaded. The filter belongs in the query. |
| A minimum price filter and price ordering | Not requested. The slider is a maximum. Both remain possible later. |

## How the pricing is stored

- `price_per_night` is `numeric(10,2)`, so the stored value keeps two decimals exactly; the domain rejects a third decimal before the database could round it.
- `discount_percent` is `smallint`.
- `ck_hotels_price_per_night`: `price_per_night IS NULL OR (price_per_night > 0 AND price_per_night <= 100000)`.
- `ck_hotels_discount_percent`: `discount_percent IS NULL OR discount_percent BETWEEN 1 AND 90`.
- `ck_hotels_discount_requires_price`: `discount_percent IS NULL OR price_per_night IS NOT NULL`. A check that evaluates to unknown passes, so each check names the `NULL` case explicitly and the last one turns a discount without a price into a false result that is rejected, including an update that clears the price of a discounted hotel.
- The listing compares `round(price_per_night * (100 - discount_percent) / 100, 2)`, or `price_per_night` without a discount, with the requested maximum. PostgreSQL rounds `numeric` halves away from zero, the same rule as the domain; a test proves it with a rate of 8.585.

## Migration

`AddHotelPricing` adds the two nullable columns and the three checks. Existing hotels keep every value and have no pricing. It is additive and safe on a database that already holds hotels, images and ratings. It is forward-only like the previous migration: `Down` throws, because dropping the columns would discard every stored price. Tests prove the upgrade on a scratch database that holds a hotel under the previous schema, the column types, every check, and that the snapshot has no pending model changes.

## Advantages

- The change is additive: existing clients ignore `pricing`, existing hotels stay valid, and no stored data moves.
- One rule set in the domain, with the database checks as a second guard.
- The price filter keeps the pagination totals correct.

## Disadvantages

- A forward-only migration: rolling back needs a restore, not `Down`.
- The rounding formula exists twice, in the domain and in the store query, and both must change together.
- Clients that send `PUT` with only some fields clear the pricing, as they already clear the other optional fields.

## Consequences

The development seed gives every seeded hotel a price and a third of them a discount, and prices the hotels it seeded before this change when their pricing is `null`. An API built from this change cannot read a database without the new columns, so apply the migration before or together with the API. The Angular client shows the price and sends `maxPrice` from its filters.

## Future improvements

A minimum price filter, ordering by price, a price shown per stay instead of per night, and other currencies. None is implemented.
