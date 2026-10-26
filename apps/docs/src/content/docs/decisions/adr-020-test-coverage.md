---
title: ADR-020 Test coverage
description: Decision to measure test coverage with the tools the test runners already support, to enforce conservative global thresholds in the web client, and to measure the API domain and application layers without enforcement.
---

## Status

| Capability | Status |
|---|---|
| Web coverage measurement with `pnpm test:coverage` and global thresholds that fail the run | Implemented |
| API coverage measurement for `HotelManagement.Domain.Tests` and `HotelManagement.Application.Tests` | Implemented |
| API threshold enforcement | Planned |
| Coverage of the Infrastructure, Api and end-to-end suites of the API | Planned |
| Coverage of the Playwright end-to-end flows | Considered |
| A hosted coverage report or a coverage badge | Considered |

## Problem

The testing strategy in `AGENTS.md` asks to measure coverage and to set reasonable thresholds for critical components, without artificial percentages. Neither the web client nor the API measured coverage, so nobody could see which code the tests never run, and nothing stopped a change that removes tests from passing unnoticed.

Coverage is the share of code lines, branches and functions that the tests execute. It shows what is untested. It does not prove that the tested code is correct.

## Alternatives considered

| Alternative | Why not |
|---|---|
| No coverage at all | Does not meet the testing strategy and hides untested code. |
| A fixed target such as 80 or 100 percent everywhere | An artificial percentage. It rewards tests written for the number instead of for the behavior. |
| Istanbul through a separate Vitest configuration file | The Angular unit-test builder already exposes coverage options for Vitest; a second configuration duplicates them. |
| Per-folder web thresholds for `core` and the data folders | Not supported by the builder: `coverageThresholds` of `@angular/build:unit-test` 22.2.4 accepts only global `statements`, `branches`, `functions`, `lines` and `perFile`. A runner configuration file would be needed for it. |
| MSBuild coverlet with `Threshold` in the API | Adds `coverlet.msbuild` and a second way to run tests. Kept as a later step. |
| ReportGenerator for the API | Another tool only to render HTML. The Cobertura file is enough to read the rates. |
| Measuring the PostgreSQL-backed API suites now | They need a disposable database and credentials; the measurement must run anywhere without them. |

## Decision

| Topic | Decision |
|---|---|
| Web provider | `@vitest/coverage-v8` 5.0.5, the same version as Vitest 5.0.5, pinned exactly as a development dependency. |
| Web configuration | The `test` target in `apps/web/angular.json` sets `coverageInclude` to `src/app/**/*.ts`, `coverageExclude` to spec files, `*-test-support.ts` helpers, `src/main.ts` and `src/app/app.config.ts`, and `coverageReporters` to `text-summary`, `html` and `lcovonly`. Coverage runs only with `pnpm test:coverage` (`ng test --no-watch --coverage`); `pnpm test` stays unchanged. The report goes to `apps/web/coverage/web`, which Git ignores. |
| Web thresholds | Global: statements 95, branches 90, functions 94, lines 95, a few points under the values measured on 2026-10-26. A run below any of them exits with a non-zero code. |
| API collector | `coverlet.collector` 10.1.0, pinned exactly, in the Domain and Application test projects only. Run with `dotnet test --collect:"XPlat Code Coverage"`; the Cobertura files go to `apps/api/TestResults`, which Git ignores. |
| API thresholds | Not enforced. The documented target is to keep the domain rules and the application services at or above 95 percent of lines and 90 percent of branches, the level measured today. |

## Measured values

Measured on 2026-10-26 with 704 web tests, 163 domain tests and 117 application tests.

| Web area | Lines | Branches | Functions |
|---|---|---|---|
| Whole app (`src/app`) | 98.31% | 94.51% | 97.61% |
| `core` (authentication and HTTP) | 96.10% | 99.06% | 98.44% |
| `features/admin/data` | 99.31% | 94.77% | 100.00% |
| `features/hotels/data` | 100.00% | 100.00% | 100.00% |

The whole app measured 98.17% of statements. The per-area values come from the lcov report and are not enforced separately.

| Web metric | Measured | Threshold |
|---|---|---|
| Statements | 98.17% | 95 |
| Branches | 94.51% | 90 |
| Functions | 97.61% | 94 |
| Lines | 98.31% | 95 |

| API assembly | Suite | Lines | Branches |
|---|---|---|---|
| `HotelManagement.Domain` | Domain tests | 99.08% (323/326) | 99.26% (135/136) |
| `HotelManagement.Application` | Application tests | 98.42% (374/380) | 97.41% (113/116) |

## Justification

The thresholds come from a measurement, not from a target picked in advance, and they sit under the measured values so normal changes do not break the run while a large drop does. Both providers are the ones the existing runners support, so no new test runner, configuration file or report tool is added. The API measures the two layers that hold the business rules and run without a database.

## Advantages

- Untested code is visible in the HTML report and the summary.
- A change that removes many web tests fails `pnpm test:coverage`.
- One development dependency per side, both exact and permissively licensed.
- `pnpm test` and `dotnet test` keep their speed and output.

## Disadvantages

- Global web thresholds can hide a drop in a critical folder when the rest of the app compensates.
- The API numbers are not enforced; a drop is only seen when someone measures.
- The Infrastructure, Api and end-to-end suites are not measured, so persistence and HTTP code have no number.
- A high percentage can still hide weak assertions.

## Consequences

Contributors run `pnpm test:coverage` before delivering web changes and add tests when it fails. A threshold is raised only after a new measurement and never above the measured value. The continuous integration workflow can call `pnpm test:coverage` to enforce the web thresholds.

## Future improvements

- Per-folder thresholds for `core` and the data folders through a runner configuration, if the global values prove too coarse.
- API threshold enforcement once the numbers are stable.
- Coverage for the PostgreSQL-backed API suites in an environment that provides the test database.
- Publishing the HTML reports from the continuous integration workflow.
