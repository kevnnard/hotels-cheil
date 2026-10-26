---
title: ADR-019 Admin session storage in the browser
description: Decision to keep the access token of the Angular administration area in sessionStorage under one key, validate it with GET /api/auth/me on restore, attach it only to same-origin /api requests and end the session on any 401 without a refresh.
---

## Status

Implemented and tested in the Angular client: login page, session restore, HTTP interceptor, route guards and the admin shell with sign out. The hotel administration screens built on it (directory, bottom-sheet create and edit forms, image slots and delete) are Implemented and described in the architecture model.

## Problem

The API of ADR-012 answers a correct `POST /api/auth/login` with a signed access token that lives 15 minutes by default, revocable through its session, and expects it in the `Authorization` header. It has no refresh endpoint and sets no cookie. The Angular administration area needs to keep that token between requests, survive a page reload, close the session on sign out and stop using a token the API no longer accepts, without moving security decisions into the browser.

## Decision

| Topic | Decision |
|---|---|
| Storage | The session (access token, email, roles array and expiry) lives in an `AuthState` service with Signals and is mirrored in `sessionStorage` under the single key `aurea.admin.session`. It survives a reload and is discarded when the tab closes. |
| Restore | On startup an application initializer reads the stored value without blocking the first render. A malformed, incomplete or expired value is removed at once. A plausible one is validated with `GET /api/auth/me` and the email, roles and expiry of the answer replace the stored ones. Any failure discards it silently, with no navigation. |
| Guards | The authenticated, Administrator and guest guards wait for the restoration before deciding. An anonymous visitor goes to `/admin/login` with the attempted address as `returnUrl`; a signed-in account without the `Administrator` role goes to the login with an explanation; a signed-in administrator is sent from the login to `/admin`. Guards only steer navigation; the API policies of ADR-004 remain the authority. |
| Header | A functional interceptor adds `Authorization: Bearer` only to same-origin requests whose path is `/api` or starts with `/api/`, and only when a session exists. Other origins, protocol-relative addresses and non-API paths never receive the token. |
| Expiry | There is no refresh and no retry. A `401` from a same-origin `/api` request, other than the login, the restore check and the sign out, clears the session and opens `/admin/login` with the attempted address. |
| Return address | `returnUrl` is used only when it starts with one slash, not two, contains no backslash and no control character, and is not the login itself; otherwise the login goes to `/admin`. |
| Sign out | `POST /api/auth/logout` is called best effort with the current token; the local session is cleared whatever the answer, including a network failure. |
| Hygiene | The token and the password are never logged and never rendered in a template. |

## Alternatives considered

| Alternative | Why not |
|---|---|
| Memory only | Safest against persistent theft, but every reload or new navigation from the address bar signs the administrator out, which makes the panel tiring to use during a review. |
| `sessionStorage` | Chosen. It survives a reload, is scoped to one tab and is cleared when the tab closes, and it needs no backend change. |
| `localStorage` | Survives closing the browser and is shared by every tab, so a stolen or forgotten token lives longer and is exposed to more pages. Nothing in the scope requires a persistent login. |
| httpOnly cookie plus a backend change | The most resistant to XSS because scripts cannot read the token, but it needs the API to issue and read cookies, CSRF protection, a same-site policy and changes to the end-to-end tests. It is outside the delivery scope of the frontend work. |

## Justification

The API contract already fixes bearer tokens with short lives and server-side revocation. Keeping the token in `sessionStorage` adds reload survival with the smallest exposure that the current contract allows, and validating it with `/api/auth/me` on restore ensures that a revoked or expired session never reaches a guarded screen as if it were valid.

## Advantages

- No backend change; the existing login, me and logout endpoints are enough.
- A reload keeps the administrator signed in; closing the tab ends it.
- The token is never sent to another origin, and one place adds it.
- A revoked session is detected on restore and on the first rejected call.

## Disadvantages

- Any script running in the page can read `sessionStorage`, so an XSS flaw would expose the token. The mitigations are Angular's template escaping, no `innerHTML` with untrusted data, the short token life and the server-side revocation, but they do not remove the risk.
- Without a refresh endpoint the administrator is sent back to the login when the token expires, losing unsaved form input.
- Each tab needs its own sign in.

## Consequences

Admin screens rely on `AuthState` and the guards for navigation and on the interceptor for the header; they never read the storage or build the header themselves. The API must keep answering `401` for missing, expired or revoked tokens so the client can end the session. A Content Security Policy that forbids inline and remote scripts becomes more valuable and should accompany deployment.

## Future improvements

A refresh endpoint with rotation so the panel can extend a session without a new login, cookie sessions with httpOnly, Secure and SameSite flags plus CSRF protection, a warning before the token expires, and a Content Security Policy for the web app. None is implemented.

## Addendum: visitor sessions

Status: Implemented.

The visitor sign in and registration pages of `/account` keep the session of a `User` or an `Administrator` in the same `AuthState` and the same `sessionStorage` key `aurea.admin.session`, with the same restore, header and sign out rules. The key name is kept so existing sessions survive the change. Only the admin login refuses an account without the `Administrator` role. The `401` rule is narrowed: inside `/admin` the session is cleared and the admin login opens with the attempted address, and anywhere else the session is cleared without navigating. The XSS tradeoff described above applies to visitor sessions as well.
