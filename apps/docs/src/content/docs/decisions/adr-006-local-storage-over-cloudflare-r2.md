---
title: ADR-006 Local storage over Cloudflare R2
description: Decision to store images locally first and keep an abstraction for Cloudflare R2.
---

## Status

Planned for local storage. Cloudflare R2 is Considered.

## Problem

Hotel images must be stored persistently without adding external credentials or services to a short exercise.

## Alternatives considered

- Local file storage on a Docker volume.
- Cloudflare R2 from the start.
- Database blobs.

## Decision

Implement local storage behind IFileStorageService, backed by a Docker volume, with safe names and stable keys. Do not implement R2 initially.

## Justification

Local storage has no external dependency or credentials. The separate contract allows R2 later without changing application code.

## Advantages

- No external service or secret.
- Simple to run in Compose.

## Disadvantages

- Not suitable for multiple instances.
- Backups depend on the volume.

## Consequences

Replaced or deleted files must be cleaned up. No real service credentials are ever committed.

## Future improvements

Consider an R2 implementation of the same contract only if deployment needs it. Nothing is committed.

## Considerations

No image storage exists in the API today, and the architecture canvas does not show it. Reconsider storage when the image requirement is taken on, and reconsider R2 only if the API runs on more than one instance or the volume backup becomes a burden. This is a consideration, not a commitment.
