---
title: ADR-013 Hotel HTTP contract for CRUD, filters, pagination and ratings
description: Decision on the hotel routes, the query filters, the pagination shape and the authorization of the rating endpoint.
---

## Status

Implemented and tested: the five routes, the filters, the pagination and the rating replacement. The HTTP suite holds 70 tests, 41 of them for the hotel endpoints, run against a real PostgreSQL 17 database through the in-process server. The application, persistence and domain suites add 178 passing tests. The contract is implemented by the hotel application service, the filtered PostgreSQL query and two thin controllers.

## Problem

The administrative API needs a complete hotel CRUD over HTTP, a listing that can be filtered and paginated, and the rating endpoint that replaces the rating of the signed-in account. The contract has to fix the routes, the query parameters, the response shapes, the error answers and the authorization, so the persistence query and the controller cannot drift apart.

## Alternatives considered

- A single action endpoint that receives the operation in the body.
- Query parameters encoded in a JSON body.
- Server-side driven pagination with an opaque cursor.
- Offset pagination with a page number and a page size.
- A dedicated rating permission separate from the hotel permissions.
- Authorizing the rating with the read permission.

## Decision

- The hotel routes live under `/api/hotels`: `GET /api/hotels`, `GET /api/hotels/{id}`, `POST /api/hotels`, `PUT /api/hotels/{id}`, `DELETE /api/hotels/{id}` and `POST /api/hotels/{id}/ratings`.
- `hotels.read` opens both listings and reads to the `Administrator` and the `User` role. `hotels.create`, `hotels.update` and `hotels.delete` open the administrative writes to the `Administrator` role only.
- The rating endpoint uses a new static policy, `hotels.rate`, open to both roles. The four permissions defined by the API skill cover the administrative CRUD of the hotel, while the approved requirement lets every authenticated account rate a hotel. The policy is named and static: no dynamic permission management is introduced.
- The rating identity is the validated `sub` claim of the signed-in account. The request body carries only the score, never a user identifier.
- The listing accepts `name`, `minRating`, `page` and `pageSize`. The name filter is a case-insensitive contains; the wildcard characters of the input are escaped, so a name that contains `%` or `_` is matched literally. The minimum rating filter keeps the hotels whose average is at least the given value, computed from the persisted votes. The page is one-based, the page size defaults to 20 and is capped at 100, and a page size outside the accepted range or a minimum rating outside the inclusive 1 to 5 is answered with `400`.
- The listing is ordered by the creation timestamp and then by the identifier, so the pages are deterministic.
- The listing response carries the items, the page, the page size, the total number of matching hotels and the total number of pages. Every item carries the rating summary with the sum, the count and the average, where a hotel without votes reports a null average and a count of zero.
- The create and update requests carry only the descriptive hotel values. The domain rules validate them inside the Application service, so an invalid value is answered with `400` and the failing field, never with an unhandled error.
- A missing hotel is answered with `404`. A rejected write leaves the stored data unchanged, which the HTTP tests assert against the database.

## Justification

Named routes and query parameters make the contract readable from a browser and easy to consume from a client. Offset pagination matches the admin use case, where a user jumps to a page rather than walking a cursor, and the total count lets the client render the page count. The rating policy is separated from the hotel CRUD permissions because rating is a user action over the hotel, not an administrative change of it.

## Advantages

- The controller stays thin: it maps the request, calls the service and maps the outcome.
- The filtering and the pagination happen in SQL, with the aggregates read in one query and no per-hotel round trip.
- The rating endpoint cannot be used to rate on behalf of another account.
- The same contract serves the future Angular client.

## Disadvantages

- Offset pagination shifts rows when the data changes between two requests.
- The total count costs an additional query on every listing.

## Consequences

- The Application layer needs a query contract and a listing outcome, and the store port gains a listing method.
- The rating permission is a fifth policy, documented next to the four from the API skill.
- The hotel listing is ordered by creation time, which is stable only while the creation timestamps are distinct enough to break the ties.

## Addendum: the image routes and the response field

ADR-015 extends this contract without changing any decision above. The hotel response gains a nullable `image` property with the content type, the dimensions and the size. Three routes are added under `/api/hotels/{id}/image`: `PUT` and `DELETE` use `hotels.update`, `GET` uses `hotels.read`. The create and update JSON bodies, the filters, the pagination, the status codes and the policies of the other routes are unchanged, and an update of the descriptive details never writes the image. The image contract is documented in [Hotel images](../hotel-images.md).

## Future improvements

- Cursor pagination, if the catalog grows enough for the offset cost to matter.
- A search endpoint with full text ranking, if the public catalog needs it.
- A bulk update endpoint, if the administrative import needs it.
