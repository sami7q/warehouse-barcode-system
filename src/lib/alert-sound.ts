/**
 * Short two-tone chime for the employee product alerts, synthesized
 * with Web Audio so there's no sound file to ship or cache.
 *
 * Browsers keep an AudioContext suspended until a user gesture, so
 * unlockAlertSound() must run inside one (any click/key on the page — see
 * useProductAlerts). Before that, playAlertSound() is a silent no-op.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

export function unlockAlertSound(): Promise<void> {
  const c = getContext();
  if (!c || c.state !== "suspended") return Promise.resolve();
  return c.resume().catch(() => {});
}

export function playAlertSound() {
  const c = getContext();
  if (!c || c.state !== "running") return;
  const start = c.currentTime;
  [880, 1320].forEach((freq, i) => {
    const t = start + i * 0.18;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}
