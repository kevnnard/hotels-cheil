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

## Coverage dependencies

Used only by `tests/HotelManagement.Domain.Tests` and `tests/HotelManagement.Application.Tests`. Version and license checked against the official NuGet flat container on 2026-10-26. The decision is in ADR-020.

| Package | Version | License | Why |
|---|---|---|---|
| `coverlet.collector` | 10.1.0 | MIT | Data collector behind `dotnet test --collect:"XPlat Code Coverage"`, which writes a Cobertura report. Latest stable. A development dependency, so it never flows to the application assemblies. |

## Persistence dependencies

Used only by `HotelManagement.Infrastructure`. Metadata and licenses come from the official NuGet flat container, fetched on 2026-10-23.

| Package | Version | License | Why |
|---|---|---|---|
| `Microsoft.EntityFrameworkCore` | 10.0.13 | MIT | Data access for PostgreSQL. Pinned above the provider minimum 10.0.4. |
| `Microsoft.EntityFrameworkCore.Relational` | 10.0.13 | MIT | Pinned directly so it matches EF Core 10.0.13 instead of resolving to the provider minimum 10.0.4. |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 10.0.3 | PostgreSQL | EF Core provider; brings Npgsql 10.0.3. |
| `Microsoft.EntityFrameworkCore.Design` | 10.0.13 | MIT | Design-time services for migrations. `PrivateAssets=all`, so it does not flow to the API. |
| `Microsoft.Extensions.Configuration.Abstractions` | 10.0.13 | MIT | Reads the administrator settings bound by the identity registration. |
| `Microsoft.Extensions.Hosting.Abstractions` | 10.0.13 | MIT | Hosts the administrator bootstrap as a startup service inside the infrastructure layer. |
| `dotnet-ef` (local tool) | 10.0.13 | MIT | Creates and applies migrations. Pinned in `.config/dotnet-tools.json`; restore with `dotnet tool restore`. |

## Image dependencies

Used only by `HotelManagement.Infrastructure`. Metadata comes from the official NuGet flat container and the 15.0.0 release license, checked on 2026-10-23; the native notice is the `Notice.txt` shipped inside the package. The decision and alternatives are in ADR-015.

| Package | Version | License | Why |
|---|---|---|---|
| `Magick.NET-Q16-AnyCPU` | 15.0.0 | Apache-2.0 wrapper; bundled native components under several licenses, see Attribution | Decodes JPEG, PNG and WebP and encodes lossless PNG and WebP. The Q16 build keeps 16-bit samples, so strict lossless never truncates precision. Published for `net10.0`; brings `Magick.NET.Core` 15.0.0 and bundled native ImageMagick libraries. |

| Topic | Note |
|---|---|
| Native runtime | Bundled for `linux-x64`, `linux-musl-x64`, `linux-arm64`, `osx-arm64` and `win-*`; there is no `osx-x64` build. The Linux container and macOS ARM64 are exercised in verification. |
| Attribution | The wrapper `Magick.NET-Q16-AnyCPU` and `Magick.NET.Core` are Apache-2.0. The native library they bundle (ImageMagick 7.1.2-33) statically contains 37 third-party components. Their notice reproduces permissive licenses (BSD, MIT, zlib, FreeType and others) and also the texts of MPL-1.1 (cairo) and of the GNU Library/Lesser GPL versions 2, 2.1 and 3 (for example glib, pango, fribidi, librsvg, libcroco, libheif, libde265, libraw, liblqr, liblzma and gdk-pixbuf). The Apache-2.0 label of the wrapper is therefore not a license assessment of what is redistributed. The package `Notice.txt` and the `Magick.NET.Core` `Copyright.txt` are kept unmodified in `apps/api/ThirdPartyNotices` and copied to `ThirdPartyNotices` beside the API in `dotnet publish` and in the runtime image. Their SHA-256 values equal those of the files in the restored packages. |
| Open legal decision | Whether redistributing the image with these LGPL and MPL components needs more than the notices (for example offering the corresponding source or allowing the native library to be replaced) has not been assessed and is not claimed. The decision belongs to the project owner before any distribution. |
| Security | Coders and delegates are restricted to PNG, JPEG and WebP by a policy; size and pixel limits apply. `dotnet list package --vulnerable --include-transitive` is part of verification. |

## Decisions

| Topic | Decision |
|---|---|
| xUnit v2 vs v3 | v2 (2.9.3). xunit.v3 4.0.2 is available but was not adopted; no requirement justifies the move. |
| `coverlet.collector` | Added at 10.1.0 to the Domain and Application test projects to measure coverage (ADR-020). No threshold enforcement and no report generator are added. |
| EF Core and provider | Latest stable major 10. The provider requires EF Core and Relational in `[10.0.4, 11.0.0)`; 10.0.13 satisfies it. |
| Template versions | The bundled `dotnet new xunit` template pins older versions of the runner and test SDK; the newer stable versions above replace them. |
| Image library | Magick.NET-Q16-AnyCPU 15.0.0 over ImageSharp 4.1.3 (conditional split license), Q8 builds (8-bit truncation) and hand-written codecs. See ADR-015. |
| Authentication packages | Identity and the JWT bearer come from the Microsoft stack at the same 10.0.13 patch as the runtime, so the packages match the shared framework. |

## Review checklist

- [ ] Every package has a compatible, permissive license. Not claimed for the native components bundled by Magick.NET; see Open legal decision.
- [x] No preview or floating versions.
- [x] Domain and Application gain no package references; Infrastructure gains only the persistence, identity and image packages above.
