---
title: ADR-009 .NET 10 SDK
description: Decision to build the API on .NET 10 and pin the SDK used for local and build consistency.
---

## Status

Implemented for the API. The API Dockerfile builds with `mcr.microsoft.com/dotnet/sdk:10.0.402` and runs on `mcr.microsoft.com/dotnet/aspnet:10.0`, and the CI workflow reads the SDK from `apps/api/global.json`.

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

EF Core and Npgsql are recorded in ADR-011 and the image library in ADR-015. Frontend, database and tooling versions are not covered by this record.

## Future improvements

Move the SDK pin and the Dockerfile `SDK_VERSION` together when the feature band changes.
