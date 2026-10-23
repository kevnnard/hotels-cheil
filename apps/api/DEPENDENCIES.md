# Backend dependencies

Packages added to `apps/api`, with the versions chosen and why. Versions were checked against nuget.org on 2026-10-23; only stable releases are used.

## Authentication dependencies

Used by `HotelManagement.Api` and `HotelManagement.Infrastructure`. Licenses come from the official NuGet flat container, fetched on 2026-10-23.

| Package | Version | License | Why |
|---|---|---|---|
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 10.0.13 | MIT | Validates the signed access tokens of the API. |
| `Microsoft.AspNetCore.Identity.EntityFrameworkCore` | 10.0.13 | MIT | Stores accounts, password hashes and roles in PostgreSQL. |

## Test dependencies

Used by `tests/HotelManagement.Domain.Tests`, `tests/HotelManagement.Application.Tests`, `tests/HotelManagement.Infrastructure.Tests` and `tests/HotelManagement.Api.Tests`. No package is referenced by `HotelManagement.Domain` or `HotelManagement.Application`.

| Package | Version | License | Why |
|---|---|---|---|
| `xunit` | 2.9.3 | Apache-2.0 | Test framework preferred by the backend rules. Latest stable 2.x. |
| `xunit.runner.visualstudio` | 3.1.5 | Apache-2.0 | Test adapter for `dotnet test`. |
| `Microsoft.NET.Test.Sdk` | 18.11.0 | MIT | Test host required by `dotnet test`. |
| `Microsoft.AspNetCore.Mvc.Testing` | 10.0.13 | MIT | Runs the API in process so the HTTP contract is tested against the real pipeline. |

## Persistence dependencies

Used only by `HotelManagement.Infrastructure`. Metadata and licenses come from the official NuGet flat container, fetched on 2026-10-23.

| Package | Version | License | Why |
|---|---|---|---|
| `Microsoft.EntityFrameworkCore` | 10.0.13 | MIT | Data access for PostgreSQL. Pinned above the provider minimum 10.0.4. |
| `Microsoft.EntityFrameworkCore.Relational` | 10.0.13 | MIT | Pinned directly so it matches EF Core 10.0.13 instead of resolving to the provider minimum 10.0.4. |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 10.0.3 | PostgreSQL | EF Core provider; brings Npgsql 10.0.3. |
| `Microsoft.EntityFrameworkCore.Design` | 10.0.13 | MIT | Design-time services for migrations. `PrivateAssets=all`, so it does not flow to the API. |
| `dotnet-ef` (local tool) | 10.0.13 | MIT | Creates and applies migrations. Pinned in `.config/dotnet-tools.json`; restore with `dotnet tool restore`. |

## Decisions

| Topic | Decision |
|---|---|
| xUnit v2 vs v3 | v2 (2.9.3). xunit.v3 4.0.2 is available but was not adopted; no requirement justifies the move. |
| `coverlet.collector` | Not added. Coverage tooling is deferred until there is a reason to measure it. |
| EF Core and provider | Latest stable major 10. The provider requires EF Core and Relational in `[10.0.4, 11.0.0)`; 10.0.13 satisfies it. |
| Template versions | The bundled `dotnet new xunit` template pins older versions of the runner and test SDK; the newer stable versions above replace them. |
| Authentication packages | Identity and the JWT bearer come from the Microsoft stack at the same 10.0.13 patch as the runtime, so the packages match the shared framework. |

## Review checklist

- [x] Every package has a compatible, permissive license.
- [x] No preview or floating versions.
- [x] Domain and Application gain no package references; Infrastructure gains only the persistence and identity packages above.
