---
title: Authentication
description: Endpoints, configuration and behavior of the authentication and authorization of the API.
---

The API authenticates with ASP.NET Core Identity and short-lived signed access tokens (ADR-012). Every authenticated request is checked against a persisted session, so a session ends immediately and not only when its token expires.

## Endpoints

| Method | Route | Auth | Success | Failures |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Anonymous | `201` with the account id and email | `400` invalid input, `409` the email is already registered |
| `POST` | `/api/auth/login` | Anonymous | `200` with the access token, its expiry, the session id, the account id, the email and the roles | `400` invalid input, `401` wrong email or password |
| `GET` | `/api/auth/me` | Bearer token | `200` with the account, its roles, the session id and the session expiry | `401` missing, expired, revoked or invalid token |
| `POST` | `/api/auth/logout` | Bearer token | `204` | `401` missing or invalid token |
| `GET` | `/api/public/hotels`, `/api/public/hotels/{id}`, `/api/public/hotels/{id}/image` | Anonymous | `200` with the active hotels and their image | `400` invalid query, `404` unknown or inactive hotel |

Registration always assigns the `User` role. The endpoint cannot grant `Administrator`.

A token is rejected when it is expired, signed with another key, issued for another audience or by another issuer, missing the `sid` claim, when its session was revoked or expired, or when the session belongs to another account. The response body is empty and the status is `401`.

Two registrations that arrive at the same time with the same email produce one `201` and one `409`: the second insert loses the race and is reported as a conflict instead of a server error.

## Configuration

| Setting | Environment variable | Required | Default |
|---|---|---|---|
| `ConnectionStrings:Hotels` | `ConnectionStrings__Hotels` | Yes | None |
| `Authentication:Jwt:Issuer` | `Authentication__Jwt__Issuer` | Yes | None |
| `Authentication:Jwt:Audience` | `Authentication__Jwt__Audience` | Yes | None |
| `Authentication:Jwt:SigningKey` | `Authentication__Jwt__SigningKey` | Yes outside development | Ephemeral key in development |
| `Authentication:Jwt:AccessTokenLifetimeMinutes` | `Authentication__Jwt__AccessTokenLifetimeMinutes` | No | `15` |
| `Authentication:Administrator:Email` | `Authentication__Administrator__Email` | No | None |
| `Authentication:Administrator:Password` | `Authentication__Administrator__Password` | No | None |

The signing key must have at least 32 characters. Generate one with `openssl rand -base64 48`.

The API refuses to start when the connection string, the issuer or the audience are missing, and when the signing key is missing outside development.

The administrator settings are read as a pair: setting only the email or only the password stops the API from starting, because a half-configured administrator would leave the deployment without an administrator account.

## First administrator

The roles `Administrator` and `User` are created at startup. When `Authentication:Administrator:Email` and `Authentication:Administrator:Password` are set, that account is created with the `Administrator` role and its password is never printed. The operation runs on every start and is idempotent: an existing account keeps its password, and an account that lost the role in a previous start gets the role back. The same configuration can stay in the environment of every instance.

The bootstrap belongs to the infrastructure layer, so the API project never writes accounts or roles.

An account without the role can still sign in, but every write returns `403`.

## Policies

| Policy | `Administrator` | `User` |
|---|---|---|
| `hotels.read` | Allowed | Allowed |
| `hotels.rate` | Allowed | Allowed |
| `hotels.create` | Allowed | Forbidden |
| `hotels.update` | Allowed | Forbidden |
| `hotels.delete` | Allowed | Forbidden |

The anonymous public catalog is read-only and sits outside these policies. A request without a valid token to an administrative route returns `401`. A request with a valid token that lacks the policy returns `403`. Neither changes stored data.

## Visitor accounts in the web app

Status: Implemented in `apps/web`.

| Page | Behavior |
|---|---|
| `/account/register` | Posts to `POST /api/auth/register`, mirroring the API rules: a valid email of at most 254 characters and a password of 8 to 128 characters with at least one letter and one digit, confirmed twice. A `409` shows that the email is already registered. After the `201` the page signs in with the same credentials. |
| `/account/sign-in` | Posts to `POST /api/auth/login` and keeps the session of any role. Unlike `/admin/login`, it never revokes the session of an account without the `Administrator` role. |

Both pages live in the public layout, are open only to visitors without a session and return to a validated `returnUrl` that must be an internal path, or to `/`. A signed-in visitor sees the email in the public header with a menu to sign out, and an administrator also sees a link to `/admin`.

The API stays the authority: registration always grants the `User` role, and a `User` can rate hotels but every hotel write still answers `403`. In the web app a `401` inside `/admin` returns to the admin login, while a `401` anywhere else only clears the session and leaves the visitor on the page.

## Not implemented

Login rate limiting and lockout, token refresh, httpOnly cookie sessions, email verification and password reset are not implemented. The reasons and what each would involve are in [Production considerations](production-considerations.md).
