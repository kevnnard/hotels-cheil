---
title: ADR-004 RBAC through policies
description: Decision to authorize through ASP.NET Core policies with fixed initial roles and permissions.
---

## Status

Planned. Authentication transport is a pending decision.

## Problem

The public catalog must be open while administrative operations are protected, without building more than the requirements justify.

## Alternatives considered

- Role checks directly in controllers.
- Policy-based authorization with fixed permissions.
- A dynamic permission system stored in the database.

## Decision

Use policies for the permissions hotels.read, hotels.create, hotels.update and hotels.delete, and the roles Administrator and User. Administrator manages hotels; User has read access. Public visitors need no account.

## Justification

Policies centralize authorization and are testable. A dynamic system is not justified by current requirements.

## Advantages

- Least privilege and clear tests.
- Backend enforcement independent of frontend guards.

## Disadvantages

- Adding permissions requires code changes.
- Fixed roles may be too coarse later.

## Consequences

Authorization tests are required. Frontend guards improve navigation only and are never trusted for security.

## Future improvements

Move to configurable permissions if requirements appear.
