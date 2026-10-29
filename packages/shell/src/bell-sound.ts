// Sin React y sin "use client": el servidor del anfitrión valida y guarda la
// configuración con estos mismos ids, y la entrada principal del paquete es
// un módulo de cliente.
export {
  BELL_ARRIVAL_SOUND_IDS,
  BELL_RING_SOUND_IDS,
  BELL_RING_STRIKES,
  DEFAULT_BELL_SOUND,
  isStaffBellSound,
  playBellSound,
  type BellArrivalSoundId,
  type BellRingSoundId,
  type StaffBellSound,
} from './bellSound';
