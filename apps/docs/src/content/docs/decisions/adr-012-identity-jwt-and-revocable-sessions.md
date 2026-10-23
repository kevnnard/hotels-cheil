---
title: ADR-012 Identity, JWT and revocable sessions
description: Decision to authenticate with ASP.NET Core Identity, short-lived signed access tokens and a persisted session that every request checks.
---

## Status

Implemented and tested: 19 HTTP tests run against a real PostgreSQL 17 database through the in-process server, covering registration, sign in, the signed-in account, logout revocation, expired tokens, foreign signatures, foreign audiences, tokens without a session, role assignment and the four hotel policies. Application, persistence and domain suites add 130 passing tests. The production configuration refuses to start without a signing key and the administrator credentials.

## Problem

The administrative API must know who calls it, must be able to end a session immediately, must not ship default credentials, and must not need a permission system that no requirement asks for.

## Alternatives considered

- Cookie sessions with the Identity cookie handler.
- Opaque access tokens resolved against the database on every request.
- Signed access tokens with rotating refresh tokens.
- Signed access tokens without any session record.
- A dynamic permission system stored in the database.
- A separate authorization server.

## Decision

- Accounts, password hashing and roles come from ASP.NET Core Identity over EF Core and PostgreSQL. Identity owns the password format; the API never issues or verifies a proprietary credential.
- `IAccessTokenIssuer` lives in Application. The Api implements it with a signed token (HS256) that carries `sub`, `email`, `sid` and `role` claims, expires after 15 minutes by default and validates issuer, audience, signature and lifetime.
- Every authenticated request looks the `sid` claim up in `auth_sessions`. A missing, revoked or expired session rejects the request, so logout takes effect at once and not only when the token expires.
- There are no refresh tokens. A caller that needs a new token signs in again and opens a new session.
- Roles are `Administrator` and `User`. Policies are `hotels.read` for both and `hotels.create`, `hotels.update` and `hotels.delete` for administrators only.
- Public registration always assigns the `User` role. The first administrator is provisioned from `Authentication:Administrator:Email` and `Authentication:Administrator:Password`, applied idempotently at startup, so the endpoint can never grant administrator rights.
- The signing key comes from `Authentication:Jwt:SigningKey` and is mandatory outside development. In development an ephemeral key is generated at startup, which invalidates previous tokens on restart and avoids shipping a default secret.
- Emails are normalized (trimmed and lowercased) and unique; Identity enforces uniqueness, the Domain rules enforce the format and the 254 character limit.

## Justification

A session row is the smallest structure that makes revocation immediate, and the session check is a single indexed lookup. Refresh tokens add a second credential family and an attack surface that no requirement demands. A dynamic permission system would need administration endpoints, storage and tests for a two-role model.

## Advantages

- Logout and revocation are immediate and verifiable.
- Password handling belongs to a maintained framework instead of custom code.
- Authorization is expressed as named policies that can be tested without a request.
- No default credentials exist in the repository or in the container images.

## Disadvantages

- Every authenticated request costs one database read.
- Restarting a development instance invalidates the tokens issued before it.
- The signing key must reach every instance that validates the same tokens.

## Consequences

- The database is required for the API to serve authenticated routes.
- A session and a token are two objects to reason about; the `sid` claim is the link between them.
- Accounts that exist in the database cannot sign in while the session table is unavailable.

## Future improvements

- Refresh tokens, if clients cannot sign in again interactively.
- A per-session token fingerprint, if token theft becomes a concern.
- A migration path to external identity providers, keeping the `IAuthenticationService` contract.
