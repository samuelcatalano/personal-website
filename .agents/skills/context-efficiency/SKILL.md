---
name: context-efficiency
description: Keeps context and token use low on multi-file work in this repo. Use when a task spans several files, needs repo exploration, long command output, test or build runs, or delegating to subagents. Skip for trivial edits, one-line answers or a file you already know.
---

# Context efficiency

Goal: least context that still finishes the task correctly. Never trade away accuracy, tests, security, scope or explicit user instructions for fewer tokens. Project rules in `AGENTS.md`/`CLAUDE.md` take precedence over this skill.

## When to use / not use

- Use: unfamiliar area, several files, noisy commands (tests, builds, logs, `git log`), large docs, subagent decisions.
- Not: typo, one known file and line, a plain question, anything where reading this skill costs more than the task.

## Mode (default ECONOMY; the user can switch it)

- **ECONOMY**: minimum sufficient context, progressive reads, short answers, no delegation, references on demand.
- **BALANCED**: wider analysis, selective delegation, validation proportional to risk.
- **DEEP**: architecture or dependency analysis, several subagents, broad tests. Only for real complexity or risk, never just because a task is long.

Modes are behaviour policies, not provider-enforced limits.

## Routine (all modes)

1. Name the scope in one line: files, symbols, done criteria.
2. Search before reading: `rg`, `rg --files`, symbol lookup. Read the needed lines, not whole files. Widen only with a reason.
3. Do not repeat a search, read or command whose result still holds. Keep what you learned.
4. Bound outputs (`head`, `-n`, `--stat`, filters, a diff instead of a file). If output is too large, narrow the query; never cut what you need to diagnose an error.
5. Exclude generated files, dependencies, `docs/evidence/` images and binary assets unless the task is about them.
6. Install nothing without need. Run the tests that match the change, not everything by default.
7. Report outcomes with file references and real numbers; never invent results or savings.

## Load a reference only when it applies

| Situation | Read |
|---|---|
| Choosing mode, trimming context, summarising | `references/context-strategy.md` |
| Finding code, deciding what to read in this repo | `references/repository-navigation.md` |
| Command output, tests, tool-call batching | `references/token-optimization.md` |
| Deciding whether and how to delegate | `references/subagent-delegation.md` |

Do not preload them. Topic docs (architecture, art, assets, rendering, tests) are listed in `AGENTS.md`; open only the one the task touches.

## Hard limits

- Do not edit files outside the task scope; do not expose secrets.
- Subagent use follows `AGENTS.md` (off by default here unless the user or plan asks).
- If saving tokens would lower reliability, spend the tokens.
