/**
 * Sonidos de la campana de notificaciones.
 *
 * Dos momentos distintos, y por eso dos catálogos:
 * - `arrival`: suena UNA vez cuando el conteo sin ver sube (llegó algo nuevo).
 * - `ring`: acompaña cada sacudida de `pr-bell-ring`, golpe por golpe.
 *
 * Todo se sintetiza con Web Audio: no hay archivos que publicar, cachear ni
 * servir desde cada app satélite. El catálogo (ids) vive aquí porque es lo que
 * el anfitrión guarda; los nombres y descripciones que ve una persona son del
 * panel que lo configura.
 */

export const BELL_ARRIVAL_SOUND_IDS = [
  'none',
  'two-notes',
  'drop',
  'three-notes',
  'bubble',
] as const;

export const BELL_RING_SOUND_IDS = [
  'none',
  'counter-bell',
  'jingle',
  'single-ting',
  'wood-tick',
] as const;

export type BellArrivalSoundId = (typeof BELL_ARRIVAL_SOUND_IDS)[number];
export type BellRingSoundId = (typeof BELL_RING_SOUND_IDS)[number];

export interface StaffBellSound {
  arrival: BellArrivalSoundId;
  ring: BellRingSoundId;
  /** 0–1. */
  volume: number;
  /**
   * Cuántas sacudidas seguidas suenan antes de callarse; `0` = todas. La
   * campana repica cada 8 s mientras haya algo sin ver, así que sin límite
   * alguien que deja tres avisos pendientes oye un golpe cada 8 s todo el día.
   */
  ringLimit: number;
}

/**
 * Callada por omisión. Publicar el paquete no puede poner a sonar a ninguna
 * app: el sonido existe sólo cuando el anfitrión lo manda configurado.
 */
export const DEFAULT_BELL_SOUND: StaffBellSound = {
  arrival: 'none',
  ring: 'none',
  volume: 0.7,
  ringLimit: 3,
};

export function isStaffBellSound(value: unknown): value is StaffBellSound {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (BELL_ARRIVAL_SOUND_IDS as readonly unknown[]).includes(candidate.arrival) &&
    (BELL_RING_SOUND_IDS as readonly unknown[]).includes(candidate.ring) &&
    typeof candidate.volume === 'number' &&
    candidate.volume >= 0 &&
    candidate.volume <= 1 &&
    Number.isInteger(candidate.ringLimit) &&
    (candidate.ringLimit as number) >= 0
  );
}

// --- Síntesis ---------------------------------------------------------------

interface AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
}

let engine: AudioEngine | null = null;

function audioContextClass(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

/**
 * Antes del primer gesto el navegador no deja sonar nada, y crear el contexto
 * antes de tiempo sólo deja una advertencia en la consola. `userActivation`
 * dice si ya hubo gesto; donde no existe, se intenta y se calla si falla.
 */
function canStartAudio(): boolean {
  const activation = (
    navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
  ).userActivation;
  return activation ? activation.hasBeenActive : true;
}

function getEngine(): AudioEngine | null {
  if (engine) {
    if (engine.ctx.state === 'suspended') void engine.ctx.resume().catch(() => {});
    return engine;
  }
  const Ctor = audioContextClass();
  if (!Ctor || !canStartAudio()) return null;
  try {
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    engine = { ctx, master, noise };
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return engine;
  } catch {
    return null;
  }
}

interface ToneSpec {
  f: number;
  /** Frecuencia final para un barrido; se alcanza en `glide` segundos. */
  f2?: number;
  glide?: number;
  t0: number;
  dur: number;
  peak: number;
  type?: OscillatorType;
  attack?: number;
}

function tone(e: AudioEngine, spec: ToneSpec) {
  const { f, f2, glide = 0.08, t0, dur, peak, type = 'sine', attack = 0.004 } = spec;
  const osc = e.ctx.createOscillator();
  const gain = e.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + glide);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(e.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(
  e: AudioEngine,
  { t0, dur, peak, freq, q }: { t0: number; dur: number; peak: number; freq: number; q: number },
) {
  const source = e.ctx.createBufferSource();
  const band = e.ctx.createBiquadFilter();
  const gain = e.ctx.createGain();
  source.buffer = e.noise;
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = q;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  source.connect(band).connect(gain).connect(e.master);
  source.start(t0, Math.random() * 0.5);
  source.stop(t0 + dur + 0.05);
}

type Voice = (e: AudioEngine, t: number) => void;

const ARRIVAL_VOICES: Record<Exclude<BellArrivalSoundId, 'none'>, Voice> = {
  // Mismas dos notas que el aviso de fotos nuevas de grupos de WhatsApp.
  'two-notes': (e, t) => {
    [660, 880].forEach((f, i) =>
      tone(e, { f, t0: t + i * 0.18, dur: 0.32, peak: 0.12, attack: 0.02 }),
    );
  },
  drop: (e, t) => {
    tone(e, { f: 1400, f2: 650, glide: 0.09, t0: t, dur: 0.25, peak: 0.2, attack: 0.003 });
  },
  'three-notes': (e, t) => {
    [1047, 1319, 1568].forEach((f, i) => {
      tone(e, { f, t0: t + i * 0.09, dur: 0.35, peak: 0.09, type: 'triangle', attack: 0.003 });
      tone(e, { f: f * 4, t0: t + i * 0.09, dur: 0.08, peak: 0.02, attack: 0.002 });
    });
  },
  bubble: (e, t) => {
    tone(e, { f: 300, f2: 1100, glide: 0.05, t0: t, dur: 0.12, peak: 0.22, attack: 0.003 });
  },
};

/**
 * Un golpe por cada extremo del vaivén de `pr-bell-ring` (8 s × 2/5/8/10 %),
 * con la fuerza proporcional al ángulo (14°, −11°, 6°, −3°). Si cambian los
 * keyframes en shell.css, esto se mueve con ellos.
 */
export const BELL_RING_STRIKES: readonly { at: number; strength: number }[] = [
  { at: 0.16, strength: 1 },
  { at: 0.4, strength: 0.79 },
  { at: 0.64, strength: 0.43 },
  { at: 0.8, strength: 0.21 },
];

const RING_VOICES: Record<Exclude<BellRingSoundId, 'none'>, Voice> = {
  'counter-bell': (e, t) => {
    const base = 1568;
    const partials: [number, number][] = [[1, 1], [2, 0.45], [2.76, 0.35], [5.4, 0.12], [8.93, 0.05]];
    for (const { at, strength } of BELL_RING_STRIKES) {
      for (const [ratio, weight] of partials) {
        tone(e, {
          f: base * ratio,
          t0: t + at,
          dur: 1.5 / Math.sqrt(ratio),
          peak: 0.07 * strength * weight,
          attack: 0.002,
        });
      }
    }
  },
  jingle: (e, t) => {
    for (const { at, strength } of BELL_RING_STRIKES) {
      noise(e, { t0: t + at, dur: 0.07, peak: 0.12 * strength, freq: 6500, q: 2.5 });
      [3700, 4900, 6300].forEach((f, i) =>
        tone(e, {
          f: f * (0.98 + Math.random() * 0.04),
          t0: t + at + i * 0.014,
          dur: 0.2,
          peak: 0.035 * strength,
          attack: 0.001,
        }),
      );
    }
  },
  'single-ting': (e, t) => {
    const at = BELL_RING_STRIKES[0]!.at;
    tone(e, { f: 2093, t0: t + at, dur: 0.9, peak: 0.06, attack: 0.002 });
    tone(e, { f: 2093 * 2.76, t0: t + at, dur: 0.25, peak: 0.012, attack: 0.002 });
  },
  'wood-tick': (e, t) => {
    for (const { at, strength } of BELL_RING_STRIKES) {
      tone(e, { f: 950, f2: 720, glide: 0.04, t0: t + at, dur: 0.06, peak: 0.16 * strength, type: 'triangle', attack: 0.001 });
      noise(e, { t0: t + at, dur: 0.025, peak: 0.05 * strength, freq: 2500, q: 4 });
    }
  },
};

/**
 * Reproduce un sonido del catálogo. Devuelve `false` si no sonó: `'none'`,
 * volumen cero, sin Web Audio, o el navegador todavía no lo permite.
 *
 * Los de `ring` ya traen el ritmo de la sacudida: se llaman al EMPEZAR cada
 * ciclo de la animación, no en cada golpe.
 */
export function playBellSound(
  kind: 'arrival',
  id: BellArrivalSoundId,
  volume: number,
): boolean;
export function playBellSound(
  kind: 'ring',
  id: BellRingSoundId,
  volume: number,
): boolean;
export function playBellSound(
  kind: 'arrival' | 'ring',
  id: BellArrivalSoundId | BellRingSoundId,
  volume: number,
): boolean {
  if (id === 'none' || !(volume > 0)) return false;
  const voice =
    kind === 'arrival'
      ? ARRIVAL_VOICES[id as Exclude<BellArrivalSoundId, 'none'>]
      : RING_VOICES[id as Exclude<BellRingSoundId, 'none'>];
  if (!voice) return false;
  const e = getEngine();
  if (!e) return false;
  try {
    e.master.gain.setValueAtTime(Math.min(volume, 1), e.ctx.currentTime);
    voice(e, e.ctx.currentTime + 0.02);
    return true;
  } catch {
    return false;
  }
}
