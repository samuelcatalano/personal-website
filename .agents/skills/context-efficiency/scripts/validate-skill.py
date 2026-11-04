#!/usr/bin/env python3
"""Validate the context-efficiency skill: frontmatter, size, links, and the Claude/Codex symlink.
Run from anywhere: python3 .agents/skills/context-efficiency/scripts/validate-skill.py"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent  # the real skill directory (Codex path)
ROOT = HERE.parents[2]
CLAUDE = ROOT / ".claude/skills/context-efficiency"
errors = []

text = (HERE / "SKILL.md").read_text()
m = re.match(r"---\nname: (.+)\ndescription: (.+)\n---\n", text)
if not m:
    errors.append("SKILL.md: frontmatter must be exactly name + description between --- lines")
else:
    if m.group(1).strip() != HERE.name:
        errors.append(f"name {m.group(1)!r} must equal the folder name {HERE.name!r}")
    if len(m.group(2)) > 400:
        errors.append("description is longer than 400 characters")
lines = text.count("\n")
if lines >= 100:
    errors.append(f"SKILL.md has {lines} lines, limit is 99")

for ref in re.findall(r"`(references/[\w.-]+\.md)`", text):
    if not (HERE / ref).is_file():
        errors.append(f"broken reference in SKILL.md: {ref}")
for f in sorted((HERE / "references").glob("*.md")):
    if f"references/{f.name}" not in text:
        errors.append(f"reference not routed from SKILL.md: {f.name}")

if not CLAUDE.exists():
    errors.append(f"missing Claude path {CLAUDE.relative_to(ROOT)} (expected symlink to the .agents skill)")
elif CLAUDE.is_symlink() and CLAUDE.resolve() != HERE:
    errors.append("Claude symlink does not resolve to the .agents skill")
elif not CLAUDE.is_symlink():
    a, b = (HERE / "SKILL.md").read_text(), (CLAUDE / "SKILL.md").read_text()
    if a != b:
        errors.append("Claude copy of SKILL.md differs from the .agents source")

print(f"SKILL.md lines: {lines}; references: {len(list((HERE / 'references').glob('*.md')))}")
print("symlink:", CLAUDE.is_symlink(), "->", CLAUDE.resolve().relative_to(ROOT) if CLAUDE.exists() else "missing")
if errors:
    print("FAIL")
    print("\n".join(" - " + e for e in errors))
    sys.exit(1)
print("OK")
