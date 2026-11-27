const clamp = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

export function createIntroState() {
  let current = Object.freeze({ phase: 'idle', stage: '', progress: 0 });
  const listeners = new Set();
  const publish = (next) => {
    current = Object.freeze(next);
    listeners.forEach((listener) => listener(current));
  };
  return {
    get current() { return current; },
    subscribe(listener) { listeners.add(listener); listener(current); return () => listeners.delete(listener); },
    loading(stage, progress) {
      if (current.phase === 'ready' || current.phase === 'started') return;
      publish({ phase: 'loading', stage, progress: Math.max(current.progress, clamp(progress)) });
    },
    ready() { if (current.phase !== 'ready' && current.phase !== 'started') publish({ phase: 'ready', stage: '', progress: 100 }); },
    started() { if (current.phase !== 'started') publish({ phase: 'started', stage: '', progress: 100 }); },
  };
}

export function hasVisited(storage) {
  try {
    const returning = storage.getItem('samuel-portfolio-visited') === 'true';
    storage.setItem('samuel-portfolio-visited', 'true');
    return returning;
  } catch {
    return false;
  }
}

export const introState = createIntroState();
