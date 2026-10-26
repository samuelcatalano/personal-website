const rainChance = { sp: 0.25, lon: 0.45, gla: 0.70 };
const coverRange = { sp: [0.12, 0.4], lon: [0.25, 0.7], gla: [0.45, 0.85] };
const clearCover = { sp: 0.12, lon: 0.25, gla: 0.45 };
const rainFields = {
  sp: { rain: 1, wet: 1, storm: 1, cover: 1, fall: 1.4, wind: 1.1 },
  lon: { rain: 0.65, wet: 1, storm: 0.2, cover: 1, fall: 0.7, wind: 0.65 },
  gla: { rain: 0.75, wet: 1, storm: 0.08, cover: 1, fall: 0.6, wind: 0.8 },
};

// ponytail: one roll drives both rain and cloud cover; add separate weather variables only if measured variety requires them.
export function createWeather({ random = Math.random, override } = {}) {
  const weather = {};
  for (const region of ['sp', 'lon', 'gla']) {
    const roll = Math.max(0, Math.min(1, random()));
    const [minCover, maxCover] = coverRange[region];
    const raining = roll < rainChance[region];
    weather[region] = override === 'rain'
      ? { ...rainFields[region] }
      : {
          rain: 0,
          wet: 0,
          storm: 0,
          cover: override === 'clear' ? clearCover[region] : minCover + roll * (maxCover - minCover),
          fall: rainFields[region].fall,
          wind: rainFields[region].wind,
          ...(raining && override !== 'clear' ? rainFields[region] : {}),
        };
    Object.freeze(weather[region]);
  }
  weather.entry = weather.sp;
  return Object.freeze(weather);
}

const weatherOverride = new URLSearchParams(globalThis.location?.search ?? '').get('weather');
// Independent page seed leaves the city's existing random sequence untouched.
let visitSeed = globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] || Date.now();
const visitRandom = () => { visitSeed ^= visitSeed << 13; visitSeed ^= visitSeed >>> 17; visitSeed ^= visitSeed << 5; return (visitSeed >>> 0) / 4294967296; };
export const visitWeather = createWeather({ random: visitRandom, override: weatherOverride });

export function lagWetness(current, target, dt) {
  if (dt === 0) return target;
  const tau = target > current ? 1.2 : 7;
  const blend = 1 - Math.exp(-Math.max(0, dt) / tau);
  return current + (target - current) * blend;
}

export function createLightning({ random = Math.random, reducedMotion = false } = {}) {
  if (reducedMotion) return () => 0;
  let next = 20 + random() * 20, flashStart = -1;
  // ponytail: one smooth pulse caps lightning at one event per scheduled interval.
  return (time, rain, storm) => {
    if (time >= next) {
      next = time + 20 + random() * 20;
      flashStart = -1;
      if (rain > 0.05 && random() < Math.max(0, Math.min(1, storm))) flashStart = time;
    }
    if (rain <= 0.05) { flashStart = -1; return 0; }
    const age = time - flashStart;
    return flashStart < 0 || time < flashStart || time >= flashStart + 0.45 ? 0 : 0.04 * Math.sin(Math.PI * age / 0.45);
  };
}
