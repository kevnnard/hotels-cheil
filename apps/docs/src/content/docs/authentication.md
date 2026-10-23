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

Registration always assigns the `User` role. The endpoint cannot grant `Administrator`.

A token is rejected when it is expired, signed with another key, issued for another audience, missing the `sid` claim, or when its session was revoked or expired. The response body is empty and the status is `401`.

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

## First administrator

The roles `Administrator` and `User` are created at startup. When `Authentication:Administrator:Email` and `Authentication:Administrator:Password` are set, that account is created once with the `Administrator` role and its password is never printed. The operation is idempotent: an existing account is left untouched, so the same configuration can stay in the environment of every instance.

An account without the role can still sign in, but every write returns `403`.

## Policies

| Policy | `Administrator` | `User` |
|---|---|---|
| `hotels.read` | Allowed | Allowed |
| `hotels.create` | Allowed | Forbidden |
| `hotels.update` | Allowed | Forbidden |
| `hotels.delete` | Allowed | Forbidden |

A request without a valid token returns `401`. A request with a valid token that lacks the policy returns `403`. Neither changes stored data.
