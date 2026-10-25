---
title: ADR-015 Strict lossless hotel images with Magick.NET
description: Decision to keep one lossless image per hotel within 400,000 bytes, using Magick.NET-Q16-AnyCPU 15.0.0 and local storage.
---

## Status

Implemented and tested.

## Problem

The exercise asks for full hotel CRUD including one image, "Maximizar el tamaño respecto a un peso de 400 KB sin perder calidad". The API must accept an upload, keep it within the weight budget without degrading it, serve it back and clean up its bytes, while PostgreSQL and the filesystem cannot share a transaction.

## Decision

| Topic | Decision |
|---|---|
| Quality | Strict lossless, selected explicitly by the project owner: "Sin pérdida estricta". Decoded pixels and dimensions are preserved exactly. Images that cannot fit through lossless compression are rejected. |
| Budget | 400 KB is read conservatively as 400,000 bytes. |
| Inputs | Static JPEG, PNG and WebP. At most 10 MiB, 4096 pixels per axis and 16,777,216 pixels. Animation, other formats, empty, corrupt and spoofed content are rejected. |
| Slot | One nullable image per hotel, stored as metadata columns on `hotels`. No gallery, no database blobs. Superseded by [ADR-017](adr-017-up-to-three-images-per-hotel.md), which allows up to three images per hotel in a `hotel_images` table. |
| Library | `Magick.NET-Q16-AnyCPU` 15.0.0, wrapper Apache-2.0, published for `net10.0`; the bundled native components carry other licenses (see Native runtime and deployment). |
| Storage | `IFileStorageService` implemented on a configured local directory outside the webroot and the sources. R2 stays Considered (ADR-006). |
| Contracts | `PUT`, `GET` and `DELETE /api/hotels/{id}/image`, multipart field `image`. Existing `hotels.read` and `hotels.update` policies apply. |

## Alternatives considered

| Alternative | Why not |
|---|---|
| `SixLabors.ImageSharp` 4.1.3 | Fully managed and portable, but its split license is conditional for downstream commercial use. It was not assumed to be eligible. |
| `Magick.NET-Q8-AnyCPU` | 8-bit samples. 16-bit PNG input would be truncated silently, which strict lossless forbids. |
| `System.Drawing.Common` | Not supported outside Windows. |
| A hand-written encoder | Unjustified maintenance and security risk. |
| Lossy WebP at a high quality | Violates the selected quality. Quality 100 is not lossless. |
| Resizing to fit | Changes dimensions, which the selected quality forbids. |
| Image in PostgreSQL | Grows the database and its backups for no requirement. |

## How the image is processed

1. The content signature selects the codec; the file name and the declared content type are ignored.
2. A header pass checks frame count and dimensions before any pixel is decoded, so a small file declaring a huge canvas is rejected cheaply.
3. The decode is forced to the detected codec. Other coders and delegates (SVG, PDF, URL and file references) are denied by a policy installed once at process start.
4. Decode warnings count as corruption for JPEG. Only `sRGB` and gray color spaces are accepted; CMYK and other spaces (a PNG declaring linear light, for example) would need a conversion and are rejected as an unsupported representation.
5. If the original already fits the budget it is stored byte for byte. No padding or recompression is attempted.
6. Otherwise lossless PNG and lossless WebP candidates are encoded. A candidate is accepted only if decoding it reproduces the same width, height, 16-bit RGBA samples (including RGB under zero alpha), ICC profile, orientation, gamma and rendering intent, and, for a PNG source, the exact bytes of its `cHRM` chromaticities. The smallest accepted candidate within the budget wins.
7. If no candidate qualifies the request is rejected and nothing changes.

A PNG source must pass its own integrity check first: every chunk checksum is verified, `IHDR` must come first and `IEND` must close the data, so a file that a decoder would tolerate is still rejected as damaged. PNG chunks that declare how colors are interpreted (`cHRM`, `sRGB`, `cICP`, `mDCV`, `cLLI`) must reach the stored PNG byte for byte; the decoder cannot be the witness because it ignores some of them, so the chunk is copied into the candidate when ImageMagick omits it and compared by its bytes. WebP cannot carry them, so a source that declares one is stored as PNG or rejected.

Candidate bytes are never trusted: acceptance is a decoded comparison, not a setting. WebP cannot carry 16-bit samples, orientation written by this ImageMagick version or a declared gamma or chromaticity, so those candidates are discarded by the comparison and a PNG candidate is used or the upload is rejected. The Magick.NET API does not expose chromaticities, which is why they are compared on the PNG chunk bytes. Tests do not depend on exact compressed bytes, which vary across codec versions.

## Two resources, no shared transaction

| Operation | Order | Failure behavior |
|---|---|---|
| Replace | Stage new file, then swap the database reference, then delete the previous file | If the swap fails or the hotel is gone, the staged file is deleted and the old image is untouched. If deleting the previous file fails, the new image is already active and the old bytes remain as an orphan. |
| Remove | Clear the reference, then delete the file | A failed file deletion leaves an orphan; the hotel already has no image. |
| Delete hotel | Delete the row, then delete the file | Same orphan behavior. |

Rules that keep concurrent requests safe:

- The reference swap, clear and hotel delete lock the hotel row in PostgreSQL (`SELECT ... FOR UPDATE`) inside one transaction, so each request learns exactly which image it replaced. This is a database-wide guarantee, not an in-process lock.
- Every upload gets a fresh generated key, so a request only ever deletes the key it displaced, never the surviving image of another request.
- Metadata updates do not write the image columns, so they cannot erase or overwrite a concurrent replacement.
- Files are written to a staging name and moved into place, so readers never see a partial file.
- A reader that loses a race with a replacement can see 404 once; repeating the request returns the new image.

Orphaned files are logged by key and are not reachable through the API. There is no cleanup job; removing orphans is a manual operation on the volume until a sweep is justified. This is not a distributed transaction and is not presented as one.

## Native runtime and deployment

Magick.NET bundles ImageMagick 7.1.2 native libraries for `linux-x64`, `linux-musl-x64`, `linux-arm64`, `osx-arm64` and `win-*`, restored with the package. There is no `osx-x64` build. The runtime image stays `mcr.microsoft.com/dotnet/aspnet`, running as the non-root `$APP_UID` user with a writable volume at `/var/lib/hotel-images`. Verified here: the whole suite on `osx-arm64`, and a runtime image built and run on `linux-arm64` with a fresh volume as the non-root user. `linux-x64` is bundled by the package but was not exercised. The native policy is installed once at process start; its per-image time limit counts from the creation of each image, so it is not a request deadline.

Magick.NET and ImageMagick are Apache-2.0 (ImageMagick under its own Apache-based license), but the native library also statically contains components under other terms. The package `Notice.txt` reproduces the permissive ones and the full texts of MPL-1.1 (cairo) and of the GNU Library and Lesser GPL versions 2, 2.1 and 3 (glib, pango, fribidi, librsvg, libcroco, libheif, libde265, libraw, liblqr, liblzma, gdk-pixbuf). Those texts are legal requirements that travel with the binaries.

The notice files are vendored unmodified in `apps/api/ThirdPartyNotices` and published to `ThirdPartyNotices` next to the API by `dotnet publish` and by the runtime image; their SHA-256 values equal those of the restored packages. Whether LGPL and MPL redistribution needs more than these notices, such as offering corresponding source or letting recipients replace the native library, has not been assessed. It is an open decision for the project owner before the image is distributed, not an assumption of compatibility.

## Advantages

- Exact pixels, with 16-bit precision, alpha and color profiles preserved.
- Verified decoded equality instead of trust in encoder flags.
- One extra dependency and no external service. The wrapper is permissive; the bundled native components are not all permissive.

## Disadvantages

- A native dependency with a large package and a wide historical CVE surface; mitigated by coder restriction, size and pixel limits, and `dotnet list package --vulnerable` in verification.
- Some valid images are rejected: large photographs rarely compress losslessly under 400,000 bytes, and so are linear-light and CMYK images.
- An original that fits is stored byte for byte, so its metadata (for example EXIF) stays in the stored file.
- CPU and memory per upload are bounded by limits and a concurrency gate, not eliminated. Measured on an Apple ARM64 laptop, an 8 to 9 megapixel image that cannot fit takes about 25 seconds to reject, because every lossless candidate is tried; images above 4 megapixels try fewer PNG variants. Plan roughly 1 GB of memory for two concurrent maximum-size images.
- Orphaned files are possible after a failed cleanup.

## Consequences

Clients must expect `413`, `415` and `422` rejections on upload. A new image replaces the previous one. R2, galleries and resizing are outside this decision.

## Future improvements

An orphan sweep, an R2 implementation of the same contract (ADR-006), and lossless JPEG transcoding if oversized JPEG files turn out to be common. None is implemented.
