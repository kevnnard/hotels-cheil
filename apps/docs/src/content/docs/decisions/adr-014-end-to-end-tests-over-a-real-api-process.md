---
title: ADR-014 End-to-end tests over a real API process
description: Decision on how the end-to-end suite starts the API, talks to it and isolates its data.
---

## Status

Implemented and tested: the suite holds 7 tests that start the API as a separate process, walk the administrative journey over a real socket and read the persisted state from PostgreSQL. The domain, application, persistence and HTTP suites add 248 passing tests.

## Problem

The domain, application, persistence and HTTP suites cover the rules, the SQL and the endpoints. The HTTP suite drives the real pipeline and the real PostgreSQL database, but it does it inside the test process, through the in-memory test server and with the configuration injected by the test host. Nothing proves that the published entry point starts with nothing but environment configuration, that the API answers over a real socket, that the production guards refuse to start a misconfigured process, or that the pieces behave when they run as separate processes with a real boundary between them.

## Alternatives considered

- Extend the HTTP suite with more cases and keep the in-process server.
- Run the API in a container for the end-to-end suite.
- Run the API as a separate process on the host, started and stopped by the test.
- Reuse the development Compose stack from the tests.
- Use an in-process Kestrel host instead of a separate process.

## Decision

- A dedicated project, `HotelManagement.E2E.Tests`, starts the API as a separate operating system process with `dotnet exec` over the built assembly and talks to it with an ordinary `HttpClient`. The process is the published entry point, not a test double.
- The server chooses its own port: the harness asks for `http://127.0.0.1:0` and reads the address the server reports once it starts listening. Nothing reserves a port before the child binds it, so there is no window where another process can take it.
- The child process receives its whole configuration through environment variables, the same way a deployment does: the connection string, the issuer, the audience, the signing key, the token lifetime and the administrator pair. No secret travels as a command line argument, and none is written to a file.
- The process runs with `ASPNETCORE_ENVIRONMENT=Production`, so the production configuration guards are exercised by the real process and not only by the test host.
- The database is isolated: the shared PostgreSQL fixture creates a uniquely named database, applies the migrations the same way the `migrator` service does in the Compose stack, and drops the database when the suite ends.
- A startup that fails releases what it took: the database creation, the migrations, the process and the health check all run inside the protection of the cleanup, so a failure in any of them drops the database and kills the process before the error propagates. The teardown disposes the process and the database independently, so a failure in one does not skip the other. Two tests prove it by counting the leftover databases after a failed start and after a failure while the database was being created.
- The configuration of the child process does not depend on the machine that runs the suite: every variable the harness provides replaces its equivalent spellings in the inherited environment, so a value written as `Authentication:Jwt:SigningKey` cannot reach the API beside the one the harness sets.
- Every wait is bounded: the address, the health check and the termination of the process have a deadline, and the health probe tolerates a cancelled request instead of treating it as a fatal error. A process that does not terminate inside its deadline is reported instead of being forgotten.
- The project references the API project without taking a reference to its assembly, so the assertions read the payloads from the wire into local records and cannot drift into the server's own types.
- The suite waits for `GET /health` to answer `200` before the first request, and it kills the process tree when the fixture is disposed.
- The captured output of the process is redacted before it reaches a failure message. The redaction covers the values that the harness supplied, the settings whose name marks them as sensitive and the password inside a connection string, and it has its own test.
- The settings that a test wants to be absent are also removed from the inherited environment of the child, so the result does not depend on the environment of the machine that runs the suite.
## Justification

A separate process is the only way to observe what a deployment observes: the real entry point, the real configuration binding, the real socket and the real startup guards. Letting the server choose the port removes the race between reserving a port and binding it. Using the environment for the configuration proves that the documented deployment contract works, because that is the contract the Compose stacks use. Reading the payloads from the wire keeps the assertions honest about the published contract instead of the server's internal shapes. Releasing the database and the process when the startup fails keeps the suite from leaking a database or an orphan process on every red run.

## Advantages

- The journey covers the whole stack at once: routing, the authentication pipeline, Identity, EF Core, Npgsql and PostgreSQL.
- The production startup guards are proven against a real process, including the exit code and the error message.
- The suite shares the fixture and the conventions of the other suites, so there is one way to create an isolated database.
- The assertions read the contract from the wire, so a change in the response shape breaks the suite.
- The assertions prove the persisted state, so a response that lies about the stored data breaks the suite.

## Disadvantages

- The suite is slower than the in-process one and needs the API assembly to be built.
- Starting a process adds failure modes of its own: a startup timeout and a process that outlives the test.
- The harness learns the bound address from the startup log of the server, so it depends on that message staying in the standard format.
- The secrets of the fixture reach the environment of a child process, so the suite must never print them.

## Consequences

- The solution carries one more test project and one more entry in the solution file.
- The API assembly has to be built before the end-to-end suite runs; the project reference with `ReferenceOutputAssembly=false` takes care of it.
- The development page documents the extra environment variable the suite needs.

## Future improvements

- A containerized end-to-end suite, when the image and the Compose stacks become the supported way to run the system.
- A smoke test in the continuous integration pipeline that only walks the health check and one authenticated read.
