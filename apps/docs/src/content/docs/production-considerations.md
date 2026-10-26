---
title: Production considerations
description: What a production deployment would need beyond this exercise, why each item matters and why it was left out. None of these items is implemented.
---

The system runs locally with Docker Compose or by hand, and every port is bound to `127.0.0.1`. A production deployment needs more than that. None of the items on this page is implemented. They were left out on purpose: the exercise asks for a working hotel catalogue and admin panel, and each item below adds infrastructure, configuration or a contract change that would put that scope and its simplicity at risk without a requirement asking for it.

Each item is labelled Planned (decided as the next step if the system were deployed) or Considered (evaluated, no decision yet).

## Summary

| Item | Status | Why it matters |
|---|---|---|
| Login rate limiting and lockout | Planned | Slows down password guessing |
| Security headers and HSTS | Planned | Reduces the impact of XSS, clickjacking and downgrade attacks |
| HTTPS termination | Planned | Protects tokens and passwords in transit |
| Explicit CORS stance | Considered | Needed only if the web and the API stop sharing an origin |
| Token refresh and cookie sessions | Considered | Removes the token from script reach and avoids forced sign outs |
| Secrets management | Planned | Keeps credentials out of files and shell history |
| Backups of the database and the image volume | Planned | The only copy of the data lives on two Docker volumes |
| Monitoring and logs | Planned | Failures are visible only in container output today |
| Image storage and CDN | Considered | The local volume suits one API instance |
| Dependency and image scanning | Considered | Catches known vulnerabilities in packages and base images |
| Status filter and unfinished product items | Considered | Product gaps known at delivery |

## Login rate limiting and lockout

Status: Planned.

`POST /api/auth/login` and `POST /api/auth/register` accept any number of attempts. A public deployment would add the ASP.NET Core rate limiter on the authentication routes, per client address and per account, and enable the lockout that ASP.NET Core Identity already supports after repeated failures. The answer must stay the same `401` for a wrong email and a wrong password, so the limit does not reveal which accounts exist.

## Security headers and HSTS

Status: Planned.

The API sets `X-Content-Type-Options: nosniff` on image downloads, and nginx hides its version. Nothing else is set. A deployment would add a Content Security Policy that forbids inline and remote scripts, which matters because the session token lives in `sessionStorage` (ADR-019), plus `X-Content-Type-Options`, `Referrer-Policy`, a frame policy against clickjacking, and `Strict-Transport-Security` once HTTPS is in place. These belong in the nginx configuration of the web container or at the edge proxy.

## HTTPS termination

Status: Planned.

Every container speaks plain HTTP on port 8080, and the API launch profile is HTTP only. Tokens and passwords travel in clear text outside the loopback interface. A deployment would terminate TLS at a reverse proxy or a load balancer in front of the web container, forward the original scheme to the API (nginx already sends `X-Forwarded-Proto`), and only then turn on HSTS.

## Explicit CORS stance

Status: Considered.

No CORS policy is configured, and none is needed today: the browser loads the web app and calls `/api` on the same origin, because the nginx container, or the Angular dev server, proxies `/api` to the API. Same-origin requests need no CORS. If the API were ever served from another origin, it would need an explicit policy with an allow list of origins, never a wildcard combined with credentials.

## Token refresh and cookie sessions

Status: Considered.

The web app keeps the access token in `sessionStorage` and attaches it only to same-origin `/api` requests (ADR-019). Any script that runs in the page can read it, so an XSS flaw would expose it. The token lives 15 minutes by default and there is no refresh, so a long admin session ends with a sign out. A production design would use httpOnly, Secure and SameSite cookies with CSRF protection, or a refresh endpoint with rotation. Both need API and client changes outside this scope.

## Secrets management

Status: Planned.

Secrets reach the containers as environment variables read from a local `.env` file that Git ignores. That is enough for one machine. A deployment would store the database password, the JWT signing key and the administrator credentials in a secret store of the hosting platform, inject them at start, rotate them, and remove the administrator password from the environment once the account exists.

## Backups

Status: Planned.

All state lives on two Docker volumes: `postgres-17-data` for the database and `hotel-images` for the image files. Deleting the volumes deletes the data, and there is no backup. A deployment would schedule `pg_dump` or a managed database with point-in-time recovery, copy the image files on the same schedule so the rows and the files stay consistent, and test a restore. The migrations of ADR-017 and ADR-018 are forward-only, which makes a restore the only rollback.

## Monitoring and logs

Status: Planned.

The API exposes `/health`, the web and docs containers have health checks, and the logs go to the container output. Nothing collects them. A deployment would ship structured logs to a central store, add metrics and traces (for example through OpenTelemetry), alert on failed health checks, error rates and image processing time, and keep tokens and passwords out of every log as the code already does.

## Image storage and CDN

Status: Considered.

The images are files on a local volume served through the API, which suits one API instance (ADR-006). Several instances, or heavy traffic, would need object storage such as Cloudflare R2 behind the existing `IFileStorageService` contract and a CDN in front of the public image routes. The orphan files that a failed cleanup can leave (ADR-015) would also need a sweep.

## Dependency and image scanning

Status: Considered.

Every dependency is pinned exactly, but nothing checks the pins against known vulnerabilities automatically. The CI workflow could add `dotnet list package --vulnerable`, `pnpm audit` and a scan of the built container images, and an update bot could propose version bumps.

## Status filter and unfinished product items

Status: Considered.

These are product gaps, not infrastructure, and they are known at delivery:

- The admin directory has no filter by active or inactive state; inactive hotels are listed with the others.
- Three seed hotels have no photo: the three inactive ones. Three visible hotels reuse the photo of a similar hotel (Banff, Chiang Mai and Edinburgh) because image generation ran out of quota.
- There is no email verification and no password reset.
- There is no real booking. The reservation card computes an estimate and sends nothing.
- The quote, suites, amenities and manager sections of the hotel detail page are static sample content.
- The architecture map is maintained by hand in `apps/docs/src/data/architecture.ts`, not generated from the code.

## Next step

Read [Development](development.md) to run the system, [ADR-019](decisions/adr-019-admin-session-storage.md) for the session tradeoff and [ADR-021](decisions/adr-021-delivery-compose-and-ci.md) for the delivery setup.
