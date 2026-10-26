#!/bin/sh
# build -> render -> compare.  usage: ./run.sh <blueprint.png>
cd "$(dirname "$0")"; B=/opt/homebrew/bin/blender
$B -b --factory-startup -P build_vw_t_cross.py 2>&1 | grep "TRIS\|rror\|BOUNDS"
$B -b --factory-startup -P render_vw_t_cross.py -- ${VIEWS:-side front rear q_front q_rear q_front_l q_rear_l} 2>&1 | grep -i "rror"
$B -b --factory-startup -P compare_vw_t_cross.py -- "${1:-/private/tmp/claude-503/-Users-samuel-catalano-Projects-samuelcatalano-personal-website/f2dc575a-ee3f-4b92-a1b8-bfaef629fe28/scratchpad/tc/bp.png}" 2>&1 | grep -i "rror"
