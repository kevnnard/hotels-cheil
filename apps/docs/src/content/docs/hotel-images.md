---
title: Hotel images
description: The up to three lossless images of a hotel, with their endpoints, limits, rejections, storage and cleanup behavior.
---

Each hotel can have up to three images, in the fixed positions 0, 1 and 2 (ADR-017). Position 0 is the primary image, shown on catalogue cards and the hero; positions 1 and 2 are extras for the detail gallery. The API keeps the decoded pixels of every image exactly as uploaded and refuses any image it cannot fit into 400,000 bytes without losing quality (ADR-015). The selected quality is "Sin pérdida estricta": no resizing, no lossy encoding and no reduced bit depth. Status: Implemented.

## Quick path

1. Sign in as an `Administrator` and create a hotel. Existing hotels and name-only creation need no image.
2. Upload with `PUT /api/hotels/{id}/images/{position}` as multipart form data with the field `image`. `PUT /api/hotels/{id}/image` is the same as position 0.
3. Read it back with `GET /api/hotels/{id}/images/{position}`, or read the metadata in the `images` property of any hotel response.

```bash
curl -X PUT "$API/api/hotels/$HOTEL_ID/images/1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@photo.png"
```

```json
{ "contentType": "image/png", "width": 1280, "height": 720, "sizeBytes": 211873 }
```

## Endpoints

| Method | Route | Policy | Success | Failures |
|---|---|---|---|---|
| `PUT` | `/api/hotels/{id}/images/{position}` | `hotels.update` | `200` with the metadata; replaces any previous image of that position | `400` empty or damaged, `413` above 10 MiB, `415` unsupported or animated, `422` not acceptable without losing quality, `404` unknown hotel or position outside 0 to 2 (when the `image` field is present), `403`, `401` |
| `GET` | `/api/hotels/{id}/images/{position}` | `hotels.read` | `200` with the bytes | `404` unknown hotel, empty position or position outside 0 to 2, `401` |
| `DELETE` | `/api/hotels/{id}/images/{position}` | `hotels.update` | `204` | `404` unknown hotel, empty position or position outside 0 to 2, `403`, `401` |
| `PUT`, `GET`, `DELETE` | `/api/hotels/{id}/image` | Same as above | Same as position 0 | Same as position 0 |

A position outside 0 to 2, such as `3` or `-1`, answers `404` with problem details and changes nothing. The one exception is a `PUT` without the multipart field `image`, which answers `400` first because the missing field is checked before the position; a `PUT` that carries the field answers `404` before its content is examined. Positions are independent: replacing one never touches another, and removing position 0 leaves positions 1 and 2 where they were, so the hotel then has no primary image until position 0 is filled again.

The images of an active hotel are also served without authentication by `GET /api/public/hotels/{id}/images/{position}`, and position 0 by `GET /api/public/hotels/{id}/image`, with the same bytes and headers. They answer `404` for an unknown or inactive hotel, an empty position and a position outside 0 to 2.

Hotel responses, single and listed, carry `image`, the metadata of position 0 or `null`, and `images`, the metadata of every filled position with its `position`, ordered by position and empty when there is none. The create and update JSON bodies are unchanged and never carry an image. Updating a hotel or rating it never changes its images.

The download returns the stored content type, an `ETag`, `Cache-Control: private, no-cache` and `X-Content-Type-Options: nosniff`. The storage directory is never served statically: administrative reads go through the read policy, and the public image route serves only active hotels without authentication.

## What is accepted

| Rule | Value |
|---|---|
| Formats | Static JPEG, PNG and WebP, chosen by the content, never by file name or declared type |
| Input size | At most 10 MiB |
| Dimensions | At most 4096 pixels per side and 16,777,216 pixels |
| Result size | At most 400,000 bytes |
| Color | sRGB and grayscale; CMYK, linear-light and other spaces are rejected |

An original that already fits is stored byte for byte, including any metadata it carries. Otherwise the API tries lossless PNG and lossless WebP and accepts a candidate only if decoding it gives the same width, height, 16-bit samples (including the color hidden under transparent pixels), color profile, orientation, gamma and rendering intent, plus the PNG color declarations (`cHRM`, `sRGB`, `cICP`, `mDCV`, `cLLI`) byte for byte when the source declares them. A candidate that cannot carry one of these, such as WebP for a 16-bit source, is discarded by that comparison. If no candidate qualifies, the request is rejected and nothing changes.

| Rejection | Status |
|---|---|
| Empty or damaged file, including a PNG with a failing chunk checksum | `400` |
| Larger than 10 MiB | `413` |
| Not JPEG, PNG or WebP, or animated | `415` |
| Beyond the pixel limits, in an unsupported color space, or not reducible to 400,000 bytes losslessly | `422` |

Large photographs rarely compress losslessly under 400,000 bytes, so many camera files are rejected by design. A request body above 11 MiB is cut off by the server before the endpoint runs; the client then sees either `413` or a closed connection, and the API stays healthy with nothing changed.

## When things fail

PostgreSQL and the filesystem cannot share a transaction. The order of operations decides what a failure leaves behind.

| Operation | Order | If a step fails |
|---|---|---|
| Replace a position | Stage the new file, swap the reference of that position under the hotel row lock, delete the previous file of that position | Swap fails or the hotel is gone: only the staged file is removed and every current image stays. Previous file cannot be deleted: the new image is live and the old file stays as an orphan. |
| Remove a position | Clear the reference of that position, delete its file | File cannot be deleted: the position is empty and the file stays as an orphan. |
| Delete hotel | Delete the row and, with it, every image row; then delete the file of every position | Same orphan behavior for each file; the other files are still deleted. |

- Concurrent replacements, removals and hotel deletions of one hotel, on the same or on different positions, serialize on the hotel row in PostgreSQL, so none loses a reference and none deletes the image of another request.
- An uncertain swap, such as a connection lost after commit, keeps the staged file when that position already references it.
- Orphans are logged by key with a warning and are unreachable through the API. There is no cleanup job; remove them by hand if needed.
- A reader racing a replacement can receive `404` once; repeating the request returns the new image.

## Database

The metadata lives in the `hotel_images` table, one row per filled position, keyed by hotel and position. The database accepts positions 0 to 2 only, caps the size at 400,000 bytes, allows one row per stored file and removes the rows with their hotel. The migration `AddHotelImageGallery` copies the image of every existing hotel whose five image columns are all set to position 0 before it drops the old image columns of `hotels`; a row with only some of them set carried no readable image and is not copied, while the hotel is kept; it is forward-only, because one column set cannot hold three positions.

## Storage and configuration

| Setting | Meaning |
|---|---|
| `Storage__Images__RootPath` | Absolute directory for the image files. Required outside development; in development it defaults to a per-user directory. It must be outside the application folder. |

The API creates the directory and checks that it can write there at startup, and refuses to start otherwise. Files are named by generated keys such as `3f2a…c9.webp`; no request value becomes a path.

Compose mounts the named volume `hotel-images` at `/var/lib/hotel-images`, owned by the non-root runtime user. The volume suits one API instance; Cloudflare R2 stays Considered (ADR-006).

## Native runtime

Magick.NET-Q16-AnyCPU 15.0.0 (Apache-2.0 wrapper) bundles native ImageMagick libraries for `linux-x64`, `linux-musl-x64`, `linux-arm64`, `osx-arm64` and `win-*`. A policy installed once at startup allows only the PNG, JPEG and WebP coders, denies delegates, filters and path references, and sets size and memory limits. The bundled native components carry several licenses, including LGPL and MPL; their full notices ship unmodified in `ThirdPartyNotices` next to the API and in the runtime image, and whether redistribution needs more is an open decision (ADR-015). Per-image time limits count from the creation of each image, so they are not a request deadline. At most two images are processed at a time, and an image that cannot fit can take tens of seconds to reject because every lossless candidate is tried.

## Checklist

- [ ] Upload, read, replace and remove work on every position for an `Administrator`; a `User` can read only.
- [ ] A rejected upload leaves the hotel row, every image and the files unchanged.
- [ ] Deleting a hotel removes the file of every position.
- [ ] The image directory is a persistent volume writable by the runtime user.

## Next step

Read [ADR-015](decisions/adr-015-strict-lossless-hotel-images.md) for the lossless decision, [ADR-017](decisions/adr-017-up-to-three-images-per-hotel.md) for the three positions, and [Hotel API](hotel-api.md) for the rest of the contract.
