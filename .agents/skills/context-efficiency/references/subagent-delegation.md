# Subagent delegation

Read before spawning or briefing a subagent. First check `AGENTS.md`: in this repo subagents are off by default unless the user or an active plan asks for them. Respect any model or effort lock the user set.

## Delegate only when there is a concrete gain

- Parallelism: independent workstreams with disjoint files.
- Specialisation: a self-contained module or investigation.
- Context isolation: noisy work (long logs, broad searches) whose full output you do not need.

Do not delegate small tasks. Delegation is not a token saver by default: count the briefing, the agent's own exploration, coordination and rework.

## Brief each agent with

- one responsibility and a clear done condition;
- the files and directories it owns, and the files it must not touch;
- only the context it needs (constraints, interfaces, the relevant doc path), not the whole session history;
- how to report: short result, `path:line` evidence, commands run, what failed;
- limits: maximum iterations or time, and the exact commit rule when it may commit (explicit paths only).

## Avoid

- Two agents editing the same file or the same git index at once.
- Several agents running the same search or investigation.
- Briefs that say "based on your findings" with no content.
- Forwarding an agent's full report to the user; consolidate it.

## Main agent duties

- Integrate and verify the outputs; review each diff before accepting it.
- Treat an agent's claim as unverified until you saw the evidence or ran the check.
- Wait for all agents before the final validation; state which agents actually ran and what they returned.
- Stop spawning when the cost no longer matches the value, and do remaining work directly.
