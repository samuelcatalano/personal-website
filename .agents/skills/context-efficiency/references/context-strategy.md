# Context strategy

Read when choosing a mode, planning a long task, or the context is filling up.

## Choosing the mode

- Start in ECONOMY. Move to BALANCED when a change crosses modules, touches shared state, or the first search shows the area is larger than expected.
- Move to DEEP only for: architecture changes, unclear root cause after two focused attempts, risky refactors, or work the user labels as audit/review.
- Move back down when the extra context stops paying off. Say the mode change in one line when it matters to the user.
- An explicit user instruction ("quick", "thorough", "deep") overrides your choice.

## What to keep in context

Keep: the task statement, the files and symbols you will edit, constraints from `AGENTS.md`, failing test names and the exact error line, decisions already made.
Drop or summarise: file contents you already acted on, long logs after you extracted the signal, search listings that did not matter.

## Compression habits

- Summarise a long result into: finding, evidence (`path:line` or the key output line), next step.
- Write long-lived detail into the repo's own docs or handoff notes, not into chat.
- When context is large, state the plan and the facts needed to continue before compaction, so nothing relies on memory of raw output.
- Prefer one consolidated answer to repeated progress narration.

## Anti-patterns

- Reading a whole large file to find one function.
- Re-reading a file after your own edit just to confirm it saved.
- Pasting full test output; report the failing cases and counts instead.
- Escalating to DEEP because the task "seems long".
