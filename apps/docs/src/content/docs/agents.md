---
title: Working with agents
description: How agent instructions and skills are loaded, delegated and verified in this repository.
---

## Files

| File | Role |
|---|---|
| `AGENTS.md` | Shared rules, discovered by Pi as a context file |
| `.pi/APPEND_SYSTEM.md` | Short workflow reinforcement for the main session |
| `.pi/skills/api/` | Backend skill with `references/backend.md` |
| `.pi/skills/app/` | Frontend skill with `references/frontend.md` |
| `.pi/scripts/verify-instructions.mjs` | Structural validator using Node built-ins |

## Activation

- Backend only: `/skill:api`. Frontend only: `/skill:app`. Both: load both.
- Pi project resources in `.pi/` load only after project trust is granted.
- Skill discovery lists name and description. It does not read the skill. Each skill and its reference must be read entirely.

## Verifying loading

| Check | What it proves |
|---|---|
| Pi startup diagnostics show no skill warnings | The skills parsed and were discovered |
| `node .pi/scripts/verify-instructions.mjs` | The files have the expected structure |
| Instruction receipt in the agent's first report | The agent states what it read; an attestation, not proof |
| Parent reviews the output | Behavior is checked by a person or the parent agent |

## Delegation

The installed gentle-pi children are started with an explicit appended system prompt. For that case Pi does not read the project `.pi/APPEND_SYSTEM.md`, so children are not assumed to inherit it. Shared rules therefore live in root `AGENTS.md`, and each handoff lists exact paths under `## Skills to load before work` with an instruction to read each entirely.

No extension was added. Discovery and read receipts cover the need, and this does not prevent a non-compliant agent.

## ODD

The installed gentle-pi package defines ODD as Organic Driven Development and states there is no ODD CLI or harness. This repository adds none. The definition is verifiable, so no owner clarification is required. The workflow is in `AGENTS.md`: contained work needs no tracking, substantial or resumable work is tracked before the first write, the parent owns continuity and delegation, documentation-only changes use structural checks instead of a simulated RED, and the docs grant no permission to commit or publish.

## Pending decisions

- Versions: Angular, Node, Tailwind, Starlight. .NET is decided in ADR-009.
- Allowed image formats, input limits, maximum dimensions, and the unit of 400 KB.
- Filter semantics.
- Authentication transport.
- Image processing library after license review.
- Test runners and the end-to-end tool.
