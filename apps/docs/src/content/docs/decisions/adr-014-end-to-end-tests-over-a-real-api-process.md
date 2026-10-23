---
title: ADR-014 End-to-end tests over a real API process
description: Decision on how the end-to-end suite starts the API, talks to it and isolates its data.
---

## Status

Implemented and tested: the suite holds 36 tests that start the API as a separate process, walk the administrative journey over a real socket and read the persisted state from PostgreSQL. The domain, application, persistence and HTTP suites add 248 passing tests.

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
- The child process receives its whole configuration through environment variables, the same way a deployment does: the connection string, the issuer, the audience, the signing key, the token lifetime and the administrator pair. No secret travels as a command line argument, and none is written to a file. The signing key and the administrator password are generated from a cryptographic random source for every fixture, so no credential is committed and two fixtures never share one; a test proves it.
- The process runs with `ASPNETCORE_ENVIRONMENT=Production`, so the production configuration guards are exercised by the real process and not only by the test host.
- The database is isolated: the shared PostgreSQL fixture creates a uniquely named database, applies the migrations the same way the `migrator` service does in the Compose stack, and drops the database when the suite ends.
- A startup that fails releases what it took: the database creation, the migrations, the process and the health check all run inside the protection of the cleanup, so a failure in any of them drops the database and kills the process before the error propagates. The teardown disposes the process and the database independently, so a failure in one does not skip the other, and it always releases the handle of the process, even when the termination deadline expires. Four tests prove it: two count the leftover databases after a failed start and after a failure while the database was being created, one proves that a failure of the cleanup does not replace the startup failure that explains the red run, and one fails the start after the server is already up and then proves with the identifier of the operating system process that nothing survived the release. The last one is the one that has power: the fixture clears its own reference to the process, so a check over that reference would pass even when the release killed nothing.
- The failed start of the cleanup test does not depend on the order in which the child binds its socket and runs its hosted services: the failure is injected by removing the signing key, which the production guard refuses before any service starts or any socket opens, and the test asserts that the failure message names that guard. A failure injected through an unreachable database would have relied on that undocumented order.
- The teardown of the database fixture clears only the connection pool of its own connection string, never the pools of the whole process, so releasing one fixture cannot close a pooled connection that a test running in parallel still owns; a test counts the sessions of a surviving fixture before and after the release.
- The configuration of the child process does not depend on the machine that runs the suite: every inherited variable whose name matches one of the variables the harness provides or removes is deleted before the child starts, comparing the names after normalizing the separator and the case, so a value written as `Authentication:Jwt:SigningKey`, as `authentication__jwt__signingkey` or in any other case cannot reach the API beside the one the harness sets. The comparison also reads the name the way the host reads it: the application strips the `DOTNET_` and the `ASPNETCORE_` prefixes that the host configuration understands, so an inherited `DOTNET_Authentication__Jwt__SigningKey` is deleted as well, and a test proves that the production guard still refuses to start when one of them is present on the machine. Such an inherited variable is handed to the child through the start parameters of the harness and is never written to the environment of the test process, so the collections that run in parallel cannot observe it; the test asserts that the test process environment stays untouched.
- A failure message about the child keeps everything the child printed: the harness waits, inside a deadline, for the end of both output streams before it builds the message, so the fatal line of a process that exits early is not lost in the middle of the read. The collector that owns the output counts its streams and only reports itself complete when the last one ends, and a test proves that contract. The wait for the exit of the process also drains the redirected streams before any assertion reads the output.
- Every wait is bounded: the address, the health check and the termination of the process have a deadline, and the health probe tolerates a cancelled request instead of treating it as a fatal error. A process that does not terminate inside its deadline is reported instead of being forgotten.
- The project references the API project without taking a reference to its assembly, so the assertions read the payloads from the wire into local records and cannot drift into the types of the API project. The guarantee is limited to that project: the test project also references the infrastructure project, explicitly and through the test support project, so the infrastructure types stay visible and the discipline of reading the persisted state with plain SQL is a convention, not something the compiler enforces.
- The suite waits for `GET /health` to answer `200` before the first request, it asserts the published health contract, the status `200` with the body `Healthy`, and it kills the process tree when the fixture is disposed.
- The rejection path of the published contract is proved over the real process: scores outside the range of 1 to 5, an empty or blank hotel name, a name over 200 characters and an update with an invalid name all answer `400`, and the persisted state stays unchanged.
- The captured output of the process is redacted before it reaches a failure message. The redaction covers the values that the harness supplied, the settings whose name marks them as sensitive and the password inside a connection string, it replaces the longest secret first so an overlapping secret cannot leave a fragment behind, and it has its own test.
- The startup guards are asserted against the raw output of the process, not against the redacted one: each guard test reads the raw output, expects the guard message in it and asserts that the signing key, the administrator password and the database password are absent from it, so the assertion proves that the API keeps the secrets out of its startup output instead of proving the redaction again. The redacted output is only used for failure messages, and the redaction has its own tests, including connection strings the parser rejects and empty ones.
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
- The guarantee that a failed start leaves nothing behind covers the failures of the suite. It does not cover a runner that is killed while it waits, because in that case nothing runs the cleanup and the child survives on its loopback port until the machine ends it.
- The harness learns the bound address from the startup log of the server, so it depends on that message staying in the standard format.
- The secrets of the fixture reach the environment of a child process, so the suite must never print them.
- The suite has no pipeline gate: the repository has no continuous integration pipeline, so nothing runs it automatically, it needs a PostgreSQL 17 database and the built API assembly, and it can rot silently until someone runs it by hand. This record does not add a pipeline.

## Consequences

- The solution carries one more test project and one more entry in the solution file.
- The API assembly has to be built before the end-to-end suite runs; the project reference with `ReferenceOutputAssembly=false` takes care of it.
- The development page documents the extra environment variable the suite needs.

## Future improvements

- A containerized end-to-end suite, when the image and the Compose stacks become the supported way to run the system.
- A smoke test in the continuous integration pipeline that only walks the health check and one authenticated read.
