// Spoken stop announcements through the browser's own speech synthesis: no audio files, no licences.
// ponytail: voice choice is the first installed voice of the page language (en-GB for English, pt-BR for Portuguese); a visitor with none hears the browser default.
export const voiceSupported = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
const TAG = { en: 'en-GB', pt: 'pt-BR' };
export function speak(text, lang) {
  if (!voiceSupported()) return;
  try {
    speechSynthesis.cancel(); // a new stop replaces the one still being read
    const u = new SpeechSynthesisUtterance(text), tag = TAG[lang] || TAG.en;
    u.lang = tag; u.rate = 0.95;
    u.voice = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-') === tag) || null;
    speechSynthesis.speak(u);
  } catch { /* speech blocked */ }
}
export const hush = () => { try { if (voiceSupported()) speechSynthesis.cancel(); } catch { /* nothing speaking */ } };
