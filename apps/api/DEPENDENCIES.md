# Backend dependencies

Packages added to `apps/api`, with the versions chosen and why. Versions were checked against nuget.org on 2026-10-23; only stable releases are used.

## Test dependencies

Used only by `tests/HotelManagement.Domain.Tests`. No package is referenced by `HotelManagement.Domain`.

| Package | Version | License | Why |
|---|---|---|---|
| `xunit` | 2.9.3 | Apache-2.0 | Test framework preferred by the backend rules. Latest stable 2.x. |
| `xunit.runner.visualstudio` | 3.1.5 | Apache-2.0 | Test adapter for `dotnet test`. |
| `Microsoft.NET.Test.Sdk` | 18.11.0 | MIT | Test host required by `dotnet test`. |

## Decisions

| Topic | Decision |
|---|---|
| xUnit v2 vs v3 | v2 (2.9.3). xunit.v3 4.0.2 is available but was not adopted; no requirement justifies the move. |
| `coverlet.collector` | Not added. Coverage tooling is deferred until there is a reason to measure it. |
| Template versions | The bundled `dotnet new xunit` template pins older versions of the runner and test SDK; the newer stable versions above replace them. |

## Review checklist

- [x] Every package has a compatible, permissive license.
- [x] No preview or floating versions.
- [x] Production projects gain no package references.
