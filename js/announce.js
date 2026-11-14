// Spoken stop announcements through the browser's own speech synthesis: no audio files, no licences.
// ponytail: voice choice is the first installed voice of the page language (en-GB for English, pt-BR for Portuguese); a visitor with none hears the browser default.
export const voiceSupported = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
const TAG = { en: 'en-GB', pt: 'pt-BR' };
let current = Promise.resolve();
// Resolves when the line being read ends, so the auto-ride can wait for it. A line that never starts (blocked until the first click, or no voice) resolves after 1.5 s.
// ponytail: a reading is cut off after 25 s so a stuck engine cannot hold the ride.
export const whenDone = () => current;
export function speak(text, lang, rate = 0.95) {
  if (!voiceSupported()) return;
  try {
    speechSynthesis.cancel(); // a new stop replaces the one still being read
    const u = new SpeechSynthesisUtterance(text), tag = TAG[lang] || TAG.en;
    u.lang = tag; u.rate = rate;
    u.voice = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-') === tag) || null;
    current = new Promise((resolve) => {
      let timer = setTimeout(resolve, 1500);
      u.onstart = () => { clearTimeout(timer); timer = setTimeout(resolve, 25000); };
      u.onend = u.onerror = () => { clearTimeout(timer); resolve(); };
    });
    speechSynthesis.speak(u);
  } catch { /* speech blocked */ }
}
// whether the browser has a voice for the page language (the list is empty until the engine has loaded it, which counts as none)
export const hasVoice = (lang) => voiceSupported() && speechSynthesis.getVoices().some(v => v.lang.replace('_', '-').toLowerCase().startsWith((TAG[lang] || TAG.en).slice(0, 2)));
export const hush = () => { try { if (voiceSupported()) speechSynthesis.cancel(); } catch { /* nothing speaking */ } };
