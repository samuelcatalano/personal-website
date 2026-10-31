#!/usr/bin/env bash
# Full NPC pack rebuild with the pip bpy module (see bl_run.py). Usage: NPC_OUT=<dir> NPC_UAL=<UAL1 glb/gltf> tools/npc/rebuild.sh [build]
#   no arg: walk retarget -> bodies (raw) -> female warp -> build;  "build": only npc_build.py (reuses npc_a_walk.blend and bodies)
# Logs go to $NPC_OUT/*.log; the pack is $NPC_OUT/npc_pack.glb.
set -euo pipefail
cd "$(dirname "$0")"
: "${NPC_OUT:?}"; : "${NPC_UAL:?}"; mkdir -p "$NPC_OUT/raw"
run() { python3 bl_run.py "$@"; }
if [ "${1:-}" != build ]; then
  run npc_walk_check.py > "$NPC_OUT/walk.log" 2>&1 || { tail -5 "$NPC_OUT/walk.log"; exit 1; }
  NPC_OUT="$NPC_OUT/raw" run npc_bodies.py > "$NPC_OUT/bodies.log" 2>&1 || { tail -5 "$NPC_OUT/bodies.log"; exit 1; }
  # every body is fitted to the rig (NPC_A's joints); men keep their feet and hands, women's shrink (warp.py FOOT_S/HAND_S)
  FOOT_S=1 HAND_S=1 RAW="$NPC_OUT/raw" run warp.py -- B C D E I J > "$NPC_OUT/warp_m.log" 2>&1 || { tail -5 "$NPC_OUT/warp_m.log"; exit 1; }
  RAW="$NPC_OUT/raw" run warp.py -- F G H K L > "$NPC_OUT/warp.log" 2>&1 || { tail -5 "$NPC_OUT/warp.log"; exit 1; }
fi
run npc_build.py > "$NPC_OUT/build.log" 2>&1 || { tail -8 "$NPC_OUT/build.log"; exit 1; }
grep -E "KNEE SUM" "$NPC_OUT/walk.log" 2>/dev/null || true
ls -l "$NPC_OUT/npc_pack.glb"
