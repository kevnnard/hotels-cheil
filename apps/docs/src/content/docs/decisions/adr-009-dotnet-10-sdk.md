---
title: ADR-009 .NET 10 SDK
description: Decision to build the API on .NET 10 and pin the SDK used for local and build consistency.
---

## Status

Implemented for the API skeleton only. Docker images are Planned and will follow the same major version.

## Problem

The backend needs a .NET version, and every developer and build must use a compatible SDK.

## Alternatives considered

- .NET 10, a supported long-term support release.
- An older supported .NET release.
- No SDK pin, using whatever SDK is installed.

## Decision

Target `net10.0` in all four backend projects and pin the SDK in `apps/api/global.json` to 10.0.402 with `rollForward` set to `latestPatch` and `allowPrerelease` set to `false`.

## Justification

A supported long-term support release avoids near-term end of support. The pin makes local and build SDKs consistent, while `latestPatch` still accepts security patches of the same feature band.

## Advantages

- Same SDK band for every developer and for the build.
- Only framework dependencies are needed for the skeleton.

## Disadvantages

- Developers must install a matching .NET 10 SDK.
- The pin must be revisited when the SDK feature band changes.

## Consequences

EF Core, Npgsql, test framework and image library versions are still pending decisions. Frontend, database and tooling versions are not covered by this record.

## Future improvements

Align Docker base images with the pinned SDK and record the EF Core and Npgsql versions in their own records.
