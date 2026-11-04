# Token optimization for tool use

Read when running commands with large output, batching calls, or running tests and builds.

## Commands

- Bound output at the source: `head -n`, `tail -n`, `--stat`, `--name-only`, `-q`, filters with `rg`/`grep`, `git log --oneline -n 10`, `git diff -- <path>`.
- If the repo wraps noisy commands with a compressor (see `AGENTS.md`), use that wrapper; its output is condensed, so re-run raw only when the result is empty, contradicts the exit code, or is garbled.
- Prefer a diff or a range of lines over a full file.
- Do not repeat a command whose result is still valid. Re-run only after the relevant state changed.
- If a result is too long, refine the query (path, pattern, count) before running again.

## Batching

- Run independent reads and searches in one batch when that reduces calls and output.
- Chain dependent steps in one command only when each failure is still visible.
- Do not batch things whose output you would have to read in full.

## Tests and builds

- Run the narrowest test that proves the change first (one file or name filter), then the broader suite proportional to risk.
- Report counts and failing case names with the exact assertion line; keep the full log in a file if needed and cite its path.
- Never claim a pass you did not run. A skipped suite is stated as skipped.
- Do not install dependencies or tools unless the task requires them; this repo has no build step.

## Verifying your own edits

Edit tools report failures. Do not re-read a file only to confirm a successful edit. Re-read when a hook or another agent may have changed it, or when a later edit depends on exact current text.

## Images and binaries

Open an image only when the visual judgement is the task. Crop or use a contact sheet instead of many full screenshots, and cite evidence paths rather than embedding them.
