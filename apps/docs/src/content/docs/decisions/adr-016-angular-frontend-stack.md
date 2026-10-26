---
title: ADR-016 Angular frontend stack with exact pins
description: Decision to build apps/web on Angular 22.2.3 with TypeScript 6.0.3, Tailwind CSS 4.3.3, Vitest 5.0.5 and Playwright 1.64.1, every dependency pinned exactly.
---

## Status

Implemented and tested: the pinned toolchain, the public landing, catalogue and hotel detail, the visitor account pages, the admin login and hotel administration, the HTTP layer, the guards and the authentication state. 704 unit and component tests run with Vitest, and 57 Playwright tests cover the public catalogue, the responsive layout and the admin journey. TypeScript 7 is Considered and not used.

## Problem

`apps/web` needs a framework, language, styling, test and end-to-end stack. The project owner asked for the latest Angular with exact versions and no range markers, and for TypeScript 7. Angular 22.2.x declares `typescript >=6.0 <6.1` as a peer dependency in `@angular/compiler-cli` 22.2.3 and `@angular/build` 22.2.4, so the two requests conflict.

## Fonts

Added for the public landing and hotel detail screens, which follow the Stitch design (project owner request, 2026-10-25).

| Package | Exact version | Use |
|---|---|---|
| `@fontsource-variable/playfair-display` | 5.3.0 | Headings, through the `font-serif` theme token. |
| `@fontsource-variable/plus-jakarta-sans` | 5.3.0 | Body text, through the `font-sans` theme token. |

- Reason: the Stitch design uses Playfair Display for headings and Plus Jakarta Sans for body text. The packages are self-hosted variable fonts imported from `src/styles.css`, so the application makes no runtime request to Google Fonts or any other font host.
- Both versions were checked on the npm registry on 2026-10-25 and pinned exactly with no caret, tilde or range.
- These two packages are the only dependencies added for this phase. `@fontsource-variable/inter` was removed because nothing uses it any more.
- The interface language is English. The Stitch copy was translated and the document uses `lang="en"`.
- Colour, spacing and type-scale tokens of the Stitch tailwind config are defined as Tailwind theme tokens in `src/styles.css`. Icons are inline SVG, so no icon font is loaded.

## Alternatives considered

- Angular 22.2.3 with TypeScript 7.0.2, hiding the peer violation with pnpm overrides or peer-dependency rules. Discarded: it forces an unsupported compiler pairing and hides a real incompatibility.
- An older Angular release that accepts TypeScript 7. Considered and not chosen: the project owner asked for the latest Angular, and no verified release accepting TypeScript 7 was identified.
- Angular 22.2.3 with TypeScript 6.0.3. Chosen.
- Caret or tilde ranges. Discarded: the owner asked for exact versions.
- TanStack Query, NgRx or Angular Material. Discarded for this phase, see ADR-007.
- A remote font or a font CDN (Google Fonts, as in the Stitch export). Discarded: it adds a runtime network dependency and a privacy leak.

## Decision

Decided by the project owner on 2026-10-25: TypeScript 6.0.3 exact, TypeScript 7 recorded as Considered. Every version below is pinned without caret, tilde or range in `apps/web/package.json`, with `save-exact=true` in `apps/web/.npmrc` and `pnpm@12.15.0` in the `packageManager` field. Each version was checked against the npm registry on 2026-10-25.

| Package | Version | Registry check and peer result | Status |
|---|---|---|---|
| `@angular/core`, `common`, `compiler`, `forms`, `platform-browser`, `router`, `compiler-cli` | 22.2.3 | Published. Peers `rxjs ^6.5.3 \|\| ^7.4.0` and `@angular/compiler 22.2.3` satisfied by rxjs 7.8.2. `zone.js` is not installed: the application is zoneless. | Implemented |
| `@angular/cli`, `@angular/build` | 22.2.4 | Published. Peer `typescript >=6.0 <6.1` satisfied by 6.0.3, `vitest ^4.0.8 \|\| ^5.0.0` by 5.0.5, `tailwindcss ^2 \|\| ^3 \|\| ^4` by 4.3.3, `postcss ^8.4.0` by 8.5.31. | Implemented |
| `typescript` | 6.0.3 | Published, latest 6.x. Required range for Angular 22.2.x. | Implemented |
| `typescript` 7.0.2 | not used | Latest dist-tag on the registry. Outside the Angular peer range. | Considered |
| `rxjs`, `tslib` | 7.8.2, 2.8.1 | Published. Satisfy the Angular and `@angular/build` peers. | Implemented |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | Published, same version. Accepted by the `@angular/build` peer. | Implemented |
| `postcss` | 8.5.31 | Published. Satisfies `@angular/build` peer. | Implemented |
| `vitest` | 5.0.5 | Published. Node engine `^22.12 \|\| ^24 \|\| >=26` met by Node 26.12.1. Optional peers for the browser mode and the UI are not installed. The coverage provider `@vitest/coverage-v8` 5.0.5 is installed, see ADR-020. | Implemented |
| `@vitest/coverage-v8` | 5.0.5 | Same version as Vitest, added for coverage measurement in ADR-020. | Implemented |
| `jsdom` | 30.1.3 | Published. Node engine met. Optional peer `canvas` is not installed. | Implemented |
| `@playwright/test` | 1.64.1 | Published. Configured in `playwright.config.ts` with the flows in `apps/web/e2e`. | Implemented |
| `eslint` | 10.13.0 | Published. Node engine met. | Implemented |
| `angular-eslint` | 22.6.0 | Published. Peers `eslint ^9 \|\| ^10` satisfied, `typescript *` satisfied, `typescript-eslint ^8.0.0` satisfied by 8.72.0. | Implemented |
| `typescript-eslint` | 8.72.0 | Published, latest. Peer `typescript >=4.8.4 <6.1.0` accepts 6.0.3. Added because `angular-eslint` needs it and it is the only listed linter peer. | Implemented |
| `prettier` | 3.8.1 | Published. Generated by the Angular CLI for formatting. | Implemented |
| `@fontsource-variable/playfair-display` | 5.3.0 | Published, OFL-1.1 license. Self-hosted variable font for headings. | Implemented |
| `@fontsource-variable/plus-jakarta-sans` | 5.3.0 | Published, OFL-1.1 license. Self-hosted variable font for body text. | Implemented |

No pnpm override, `peerDependencyRules` or `auto-install-peers` setting is used. The workspace file `apps/web/pnpm-workspace.yaml` only allows the install scripts of `esbuild`, `lmdb`, `@parcel/watcher` and `msgpackr-extract`, which pnpm 12 blocks by default; these are native binaries for the build and dev server.

Other decisions:

| Topic | Decision | Status |
|---|---|---|
| Structure | `src/app/core`, `shared`, `layouts`, `features`, standalone components, Signals, Reactive Forms, Angular Router, HttpClient, strict TypeScript and strict templates. | Implemented |
| Routing | Public routes under `/` in a public layout: the landing and catalogue, `/hotels/:id` and the visitor pages under `/account`. Administrative routes under `/admin`: `/admin/login` and a protected area with `/admin/hotels/new` and `/admin/hotels/:id/edit`. Lazy loading per feature. Unknown addresses go to `/`. | Implemented |
| Guards | `authenticatedGuard`, `administratorGuard` and `guestGuard` read an `AuthState` Signals service in `core`. They only steer navigation and never call the server. Backend policies (ADR-004, ADR-012) remain the security boundary. | Implemented |
| Authentication transport and token storage | Bearer token kept in `sessionStorage`, see ADR-019. | Implemented |
| Development API access | Angular dev-server proxy `proxy.conf.json` sends `/api` to `http://127.0.0.1:5080`, so the API needs no CORS change. | Implemented |
| Production routing between web and API | The nginx container of the web app proxies `/api` to the API on the same origin, see ADR-021. | Implemented |
| Styling | Tailwind CSS 4 through `@tailwindcss/postcss`, with Plus Jakarta Sans as the sans font and Playfair Display as the serif font, see the Fonts section. | Implemented |
| Unit and component tests | Vitest through the `@angular/build:unit-test` builder, jsdom environment. | Implemented |
| End-to-end tests | Playwright with Chromium projects at 1280, 768, 390 and 360 px, run against the seeded stack through `BASE_URL`, or against a dev server it starts itself. | Implemented, run locally |
| Node | Angular engines accept `^22.22.3 \|\| ^24.15.0 \|\| >=26`. Node 26.12.1 is pinned in the web and docs Dockerfiles (`node:26.12.1-alpine3.24`) and in the CI workflow; there is no `.nvmrc` or `engines` field. | Implemented |

## Justification

Angular 22.2.3 is the latest release requested by the owner and its supported TypeScript range is explicit. TypeScript 6.0.3 is the only version that satisfies every peer without suppression, so exact pins stay verifiable. The Angular unit-test builder supports Vitest natively, which avoids a second test runner. Tailwind CSS is required by the app rules. Playwright is the end-to-end tool for critical flows required by the testing strategy. The two fonts are bundled so no font is requested from a third party at runtime. The design source is a reference only and no remote asset or CDN script from it is carried into the app.

## Advantages

- Every dependency is reproducible and verified against its peers.
- No suppression hides an incompatibility.
- Few dependencies: no state library, no component library.
- The app runs on its own with the dev proxy and does not depend on the documentation site.

## Disadvantages

- TypeScript 7 features and speed are unavailable until Angular supports it.
- Exact pins need deliberate upgrades.
- pnpm 12 requires an explicit allow list for native install scripts.
- The workspace carries a lockfile and an allow list that must be reviewed when dependencies change.

## Consequences

Upgrading TypeScript requires a new Angular release whose peer range includes it, then a new record. Authentication storage is recorded in ADR-019 and production routing and the container build in ADR-021. `playwright.config.ts` is outside the application TypeScript projects and is not type-checked by `tsc`; Playwright transpiles it when it runs.

## Future improvements

- Revisit TypeScript 7 when an Angular release accepts it.
- Pin Node for local runs too, for example with an `engines` field.
- Run the Playwright flows in CI (ADR-021).
