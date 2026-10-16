// Optimised 3D models (assets/models/*.glb). Heights are target scene heights in metres (stylised, consistent per diorama).
export const ALLOWED_LICENSES = ['CC Attribution', 'CC0 Public Domain', 'CC0 (author declared)'];

const CREDITS = {
  "a2e7c359bdbf4a4682dd165a2397fb36": {
    "title": "Catedral da Sé de São Paulo",
    "author": "JackeHelen",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-a2e7c359bdbf4a4682dd165a2397fb36"
  },
  "7eb9d1c77f9b43b088128fc5baa249bb": {
    "title": "MASP - Museu de Arte de São Paulo (simplificado)",
    "author": "ximboleta",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-7eb9d1c77f9b43b088128fc5baa249bb"
  },
  "be0e5bf3b1c34e4da38d4b1a9a47d3f9": {
    "title": "Ponte Octavio Frias de Oliveira - Estaiada",
    "author": "Isaque Sprogis",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-be0e5bf3b1c34e4da38d4b1a9a47d3f9"
  },
  "65cc7c4349174f7bbb20ed70206377b5": {
    "title": "Low-poly Airplane",
    "author": "MaX3Dd",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-65cc7c4349174f7bbb20ed70206377b5"
  },
  "1fed3793e2f94d6c9b22805b568119d1": {
    "title": "London heathrow [LHR] 3D Model",
    "author": "R A Y Y A N",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-1fed3793e2f94d6c9b22805b568119d1"
  },
  "b5f82ba2e3614be2a69755a2a613579a": {
    "title": "Big Ben",
    "author": "Julian Toquica",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-b5f82ba2e3614be2a69755a2a613579a"
  },
  "74eaf18882314264b474861d564fca36": {
    "title": "London eye",
    "author": "mohamedhussien",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-74eaf18882314264b474861d564fca36"
  },
  "0021ac55a9d54c13b655a2ed430d01f6": {
    "title": "London Tower Bridge",
    "author": "purpleguy<3",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-0021ac55a9d54c13b655a2ed430d01f6"
  },
  "fd20346281d04e0c8b62b8d2354b936e": {
    "title": "WEMBLEY_MKIV",
    "author": "giuseppe302",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-fd20346281d04e0c8b62b8d2354b936e"
  },
  "b809e5698e3444a3b62bb58654caac75": {
    "title": "Low Detail London Bus",
    "author": "JohnnySix",
    "license": "CC Attribution",
    "url": "https://sketchfab.com/3d-models/model-b809e5698e3444a3b62bb58654caac75"
  },
  "815ca9e4e85844d6b702cb65ebc7dac8": {
    "title": "london_mobile_game_assets_(CC0)",
    "author": "britdawgmasterfunk",
    "license": "CC0 (author declared)",
    "url": "https://sketchfab.com/3d-models/model-815ca9e4e85844d6b702cb65ebc7dac8"
  }
};

export const MODELS = [
  { id: 'se', file: 'se.glb', chapter: 'saopaulo', height: 45, uid: 'a2e7c359bdbf4a4682dd165a2397fb36' },
  { id: 'masp', file: 'masp.glb', chapter: 'saopaulo', height: 12, uid: '7eb9d1c77f9b43b088128fc5baa249bb' },
  { id: 'estaiada', file: 'estaiada.glb', chapter: 'saopaulo', height: 60, uid: 'be0e5bf3b1c34e4da38d4b1a9a47d3f9' },
  { id: 'plane', file: 'plane.glb', chapter: 'flight', height: 4, uid: '65cc7c4349174f7bbb20ed70206377b5' },
  { id: 'heathrow', file: 'heathrow.glb', chapter: 'heathrow', height: 16, uid: '1fed3793e2f94d6c9b22805b568119d1' },
  { id: 'bigben', file: 'bigben.glb', chapter: 'westminster', height: 60, uid: 'b5f82ba2e3614be2a69755a2a613579a' },
  { id: 'londoneye', file: 'londoneye.glb', chapter: 'westminster', height: 70, uid: '74eaf18882314264b474861d564fca36' },
  { id: 'towerbridge', file: 'towerbridge.glb', chapter: 'towerbridge', height: 40, uid: '0021ac55a9d54c13b655a2ed430d01f6' },
  { id: 'wembley', file: 'wembley.glb', chapter: 'wembley', height: 70, uid: 'fd20346281d04e0c8b62b8d2354b936e' },
  { id: 'bus', file: 'bus.glb', chapter: 'all', height: 4.6, uid: 'b809e5698e3444a3b62bb58654caac75' },
  { id: 'taxi', file: 'london-props.glb', node: null, chapter: 'roadtowembley', height: 1.7, uid: '815ca9e4e85844d6b702cb65ebc7dac8' },
  { id: 'phonebox', file: 'london-props.glb', node: null, chapter: 'roadtowembley', height: 2.5, uid: '815ca9e4e85844d6b702cb65ebc7dac8' },
].map((m) => ({ ...m, credit: CREDITS[m.uid] }));

export function creditsFor() {
  const seen = new Set();
  return MODELS.filter((m) => !seen.has(m.file) && seen.add(m.file)).map((m) => m.credit);
}
