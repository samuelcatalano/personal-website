// One decoded crowd loop shared by every approach; the existing graph owns mute and suspension.
export function createStadium({ c, bus }) {
  const filter = c.createBiquadFilter(), gain = c.createGain();
  filter.type = 'lowpass'; filter.frequency.value = 1800; filter.Q.value = 0.5;
  gain.gain.value = 0;
  filter.connect(gain).connect(bus.people);
  const ready = fetch(new URL('../../../assets/audio/wembley-crowd.mp3', import.meta.url))
    .then((response) => { if (!response.ok) throw Error('Stadium audio unavailable'); return response.arrayBuffer(); })
    .then((data) => c.decodeAudioData(data))
    .then((buffer) => {
      const source = c.createBufferSource(); source.buffer = buffer; source.loop = true;
      source.connect(filter); source.start();
      return source;
    }).catch(() => null); // an unavailable sample must not interrupt the rest of the soundscape
  return { ready, update(level) { gain.gain.setTargetAtTime(level, c.currentTime, 0.6); } };
}
