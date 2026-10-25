---
title: ADR-017 Up to three images per hotel
description: Decision to give each hotel up to three lossless images in fixed positions 0, 1 and 2, stored in a hotel_images table, with position 0 as the primary image.
---

## Status

Implemented and tested.

## Problem

ADR-015 kept one nullable image per hotel as five columns of `hotels`. The catalogue needs a primary image for its cards and hero, and the detail page needs a small gallery. The API must store more than one image per hotel without breaking the clients that read `image` and call `/image`, and without losing the images already stored.

## Decision

| Topic | Decision |
|---|---|
| Slots | Up to three images per hotel, in the fixed positions 0, 1 and 2, decided by the project owner. Position 0 is the primary image; 1 and 2 are extras for the detail gallery. |
| Independence | Positions are independent. Replacing one never touches another, and removing one never shifts the others. Removing position 0 leaves the hotel without a primary image until it is filled again. |
| Quality | Every position keeps every ADR-015 rule: strict lossless, 400,000 bytes, input limits and the same rejections. |
| Storage | A `hotel_images` table keyed by hotel and position, with the storage key, content type, width, height and size. The database checks the position range and the metadata, keeps the storage key unique and deletes the rows with their hotel. |
| Contracts | `PUT`, `GET` and `DELETE /api/hotels/{id}/images/{position}` and the anonymous `GET /api/public/hotels/{id}/images/{position}`, with the existing `hotels.update` and `hotels.read` policies. A position outside 0 to 2 answers `404` with problem details, except that a `PUT` without the multipart field `image` answers `400` first: the missing field is checked before the position. A `PUT` that carries the field answers `404` for a position outside 0 to 2 before its content is examined. |
| Compatibility | The `/image` routes stay and act on position 0 with the same statuses, bodies and headers. Hotel responses keep `image` as the metadata of position 0, or `null`, and add `images`, ordered by position and empty when there is none. |
| Layers | The domain owns the position rule (`HotelImageSlot`). The application keeps one `IHotelImageService` and one `IHotelStore`, both taking the position. EF Core and multipart stay in Infrastructure and Api. |

## Alternatives considered

| Alternative | Why not |
|---|---|
| Fifteen columns on `hotels`, five per position | Repeats the constraints three times, makes the copy and the uniqueness of storage keys awkward, and grows with every new position. |
| An ordered list that compacts on removal | Moving images when one is removed changes what the primary image is without anyone choosing it, and needs every request to know the current order. |
| Separate services or controllers for the gallery | Duplicates the lossless pipeline, the compensation and the policies. One service with a position keeps one lifecycle. |
| An unbounded gallery | Not required. Three fixed positions match the catalogue and the detail page and keep the storage per hotel bounded. |
| Replacing the `image` field and the `/image` routes | Breaks the clients that already read them. Keeping them as position 0 costs one route attribute per action. |

## How the positions are stored

- `hotel_images` has the primary key `(hotel_id, position)`, the check `position BETWEEN 0 AND 2`, the metadata check of ADR-015, the unique index on `storage_key` and a foreign key to `hotels` with cascade delete.
- A replacement locks the hotel row (`SELECT ... FOR UPDATE`), reads the image of that position, writes the new one with an upsert on `(hotel_id, position)` and moves the update timestamp of the hotel. A removal deletes the row of that position under the same lock.
- Deleting a hotel locks the row, reads every image row and deletes the hotel; the cascade removes the image rows and the service then deletes every released file.
- The listing loads the images of a page with the page, in the same query, ordered by position, so a page never issues one query per hotel.
- Descriptive updates never write `hotel_images`, so they cannot erase a concurrent replacement of any position.

## Two resources, no shared transaction

The order of ADR-015 is unchanged and applies per position: stage the new file, swap the reference of that position under the hotel row lock, then delete the displaced file. If the swap fails, only the staged file is removed, unless that position already references it after an uncertain commit. Uploads to different positions of one hotel serialize on the same row lock, so each learns exactly which image it displaced. Orphans are still possible after a failed file deletion and are logged by key.

## Migration

`AddHotelImageGallery` creates `hotel_images`, copies the image of every hotel whose five image columns are all set into position 0 with identical values, and only then drops the five image columns, their check and their index from `hotels`. It is safe on a database that already holds images. The old check did not forbid NULLs in some columns: a check that evaluates to unknown passes, so a row with, for example, a storage key but no width was legal. Such partial rows carry no usable image, could not have been read by the API before either, and are intentionally not copied; the hotel itself is kept. The copied rows satisfy the new constraints. The migration is forward-only: `Down` throws, because one set of columns cannot hold three positions without losing data. Tests prove the upgrade on a scratch database that holds images under the previous schema and the creation on an empty database.

## Advantages

- One lifecycle, one pipeline and one set of policies for every position.
- Existing clients keep working through `image` and `/image`.
- The database, not only the application, enforces the three positions and one row per stored file.

## Disadvantages

- A forward-only migration: rolling back needs a restore, not `Down`.
- Three images per hotel triple the worst-case disk use per hotel and the worst-case upload work.
- A hotel can have extras without a primary image after position 0 is removed; clients must handle `image: null` with a non-empty `images`.

## Consequences

Clients read `images` for the gallery and keep reading `image` for the primary picture. The Angular client still shows only the primary image; showing positions 1 and 2 is frontend work outside this decision. A running API built from the previous code cannot read a database migrated by this change, and the reverse is also true, so deploy the migration and the API together.

## Future improvements

Reordering positions with one request, a gallery view in the Angular detail page, and the orphan sweep of ADR-015. None is implemented.
