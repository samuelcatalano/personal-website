"""Rebuild models.json from each car's tools/vehicles/<id>/record.json (run after any rebuild)."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
CARS = {  # id -> regions it drives in, recognition cues
    'toyota-corolla': (['br', 'uk'], 'Long low sedan bonnet and separate boot; narrow J headlamps; trapezoidal intake; stretched rear lamps', ['Paint_Color']),
    'vw-t-cross': (['br', 'uk'], 'Square upright SUV greenhouse; black wheel cladding; full-width rear light bar', ['carpaint']),
    'nissan-qashqai': ('uk', 'V-motion grille; boomerang lamps; swept roof with pinched rear quarter', ['qcarpaint_red1']),
    'honda-hr-v': (['br', 'uk'], 'Compact crossover with a sloping roof, broad grille and narrow headlamps', ['M_2022_Honda_HR_V_eHEV_Platinum_White_Pearl']),
    'land-rover-range-rover': (['br', 'uk'], 'Tall luxury SUV with upright greenhouse and high flat roof', ['CarPaint']),
    'mercedes-e63-amg-s-wagon': (['br', 'uk'], 'Long performance estate with low roofline and broad grille', ['CAR_PAINT']),
}
models = []
for cid, (region, sig, paint) in CARS.items():
    r = json.loads((ROOT / f'tools/vehicles/{cid}/record.json').read_text())
    r['region'] = region
    r.setdefault('signature', sig)
    r.setdefault('paintMaterials', paint)
    models.append(r)
out = ROOT / 'tools/vehicles/regional-fleet/models.json'
cat = json.loads(out.read_text()); cat['models'] = models
out.write_text(json.dumps(cat, indent=1) + '\n')
print(len(models), 'models')
