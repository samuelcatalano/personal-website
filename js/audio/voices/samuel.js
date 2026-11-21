// Consume animation cues even when muted/loading, so a missed greeting never plays late.
export function createSamuelVoice({ c, bus }) {
  let buffer = null, sequence = 0, source = null, envelope = null;
  const ready = fetch(new URL('../../../assets/audio/samuel-wave.mp3', import.meta.url))
    .then(response => { if (!response.ok) throw Error('Samuel greeting unavailable'); return response.arrayBuffer(); })
    .then(data => c.decodeAudioData(data))
    .then(decoded => { buffer = decoded; return decoded; }).catch(() => null);
  const stop = (fade = 0) => {
    if (!source) return;
    if (fade) {
      envelope.gain.cancelScheduledValues(c.currentTime);
      envelope.gain.setValueAtTime(envelope.gain.value, c.currentTime);
      envelope.gain.linearRampToValueAtTime(0, c.currentTime + fade);
    }
    source.stop(c.currentTime + fade);
    if (!fade) source = null;
  };
  return {
    ready,
    update(cue, enabled) {
      const fresh = !!cue && cue.sequence !== sequence;
      sequence = cue?.sequence ?? 0;
      if (!enabled || !cue?.visible) { stop(enabled ? .08 : 0); return; }
      if (!fresh || !sequence || !buffer || cue.elapsed > .2) return;
      stop();
      const playing = c.createBufferSource(), gain = c.createGain();
      playing.buffer = buffer;
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(.4335, c.currentTime + .015);
      playing.connect(gain).connect(bus.people);
      playing.onended = () => { playing.disconnect(); gain.disconnect(); if (source === playing) source = null; };
      source = playing; envelope = gain;
      playing.start();
    },
  };
}
