"""Rebuild models.json from each car's tools/vehicles/<id>/record.json (run after any rebuild)."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
CARS = {  # id -> regions it drives in, recognition cues
    'toyota-corolla': (['br', 'uk'], 'Long low sedan bonnet and separate boot; narrow J headlamps; trapezoidal intake; stretched rear lamps'),
    'vw-t-cross': (['br', 'uk'], 'Square upright SUV greenhouse; black wheel cladding; full-width rear light bar'),
    'nissan-qashqai': ('uk', 'V-motion grille; boomerang lamps; swept roof with pinched rear quarter'),
}
MATS = ['FleetBody', 'FleetGlass', 'FleetTrim', 'FleetRubber', 'FleetLights', 'FleetInterior']
models = []
for cid, (region, sig) in CARS.items():
    r = json.loads((ROOT / f'tools/vehicles/{cid}/record.json').read_text())
    r.pop('meshes', None)
    r.update(region=region, materials=MATS, meshCount=6, signature=sig,
             referenceLimit='Manufacturer dimensions; contours modelled from public blueprints/brochure drawings, not CAD.')
    models.append(r)
out = ROOT / 'tools/vehicles/regional-fleet/models.json'
cat = json.loads(out.read_text()); cat['models'] = models
out.write_text(json.dumps(cat, indent=1) + '\n')
print(len(models), 'models')
