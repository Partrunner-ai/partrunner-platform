/**
 * Fixture data for the page recipes. Every name, RFC and amount is invented.
 * Money and dates use one format for the whole catalog: `$12,400.00` and
 * `24 nov 2026`.
 */

const MONEY = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatMoney(value: number): string {
  return MONEY.format(value);
}

/** `2026-11-24` to `24 nov 2026`. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

// ---------------------------------------------------------------- Colocadas

export type PlacementStatus = 'pending' | 'placed' | 'cancelled';

export interface Placement {
  id: string;
  driver: string;
  plate: string;
  fleet: string;
  project: string;
  date: string;
  weeklyRate: number;
  status: PlacementStatus;
}

export const PLACEMENT_STATUS: Record<
  PlacementStatus,
  { label: string; tone: 'warning' | 'success' | 'neutral' }
> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  placed: { label: 'Colocada', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
};

export const PROJECTS = ['Última milla Norte', 'Reparto Bajío', 'Centros de distribución', 'Paquetería exprés'];

export const PLACEMENTS: Placement[] = [
  { id: 'c01', driver: 'Mauricio Ibarra Soto', plate: 'LRT-482-B', fleet: 'Transportes Aguilar del Norte', project: PROJECTS[0]!, date: '2026-11-24', weeklyRate: 12400, status: 'placed' },
  { id: 'c02', driver: 'Elena Cordero Vidal', plate: 'MXD-190-A', fleet: 'Logística Cumbres', project: PROJECTS[1]!, date: '2026-11-24', weeklyRate: 11800, status: 'placed' },
  { id: 'c03', driver: 'Gerardo Palacios Nieto', plate: 'KPT-731-C', fleet: 'Fletes Sierra Madre', project: PROJECTS[2]!, date: '2026-11-23', weeklyRate: 13250, status: 'pending' },
  { id: 'c04', driver: 'Itzel Barragán Lugo', plate: 'NJR-264-D', fleet: 'Transportes Aguilar del Norte', project: PROJECTS[0]!, date: '2026-11-23', weeklyRate: 12400, status: 'placed' },
  { id: 'c05', driver: 'Rubén Escamilla Díaz', plate: 'LTG-905-A', fleet: 'Ruta Dorada', project: PROJECTS[3]!, date: '2026-11-22', weeklyRate: 14100, status: 'placed' },
  { id: 'c06', driver: 'Paulina Quiroz Mena', plate: 'MCV-318-B', fleet: 'Logística Cumbres', project: PROJECTS[1]!, date: '2026-11-21', weeklyRate: 11800, status: 'placed' },
  { id: 'c07', driver: 'Octavio Zamudio Ríos', plate: 'KRD-047-E', fleet: 'Fletes Sierra Madre', project: PROJECTS[2]!, date: '2026-11-21', weeklyRate: 13250, status: 'placed' },
  { id: 'c08', driver: 'Daniela Fierro Campos', plate: 'NBH-552-A', fleet: 'Distribuidora Valle Azul', project: PROJECTS[0]!, date: '2026-11-20', weeklyRate: 12400, status: 'pending' },
  { id: 'c09', driver: 'Joaquín Saldaña Rojas', plate: 'LHM-613-C', fleet: 'Ruta Dorada', project: PROJECTS[3]!, date: '2026-11-19', weeklyRate: 14100, status: 'placed' },
  { id: 'c10', driver: 'Citlali Montoya Ruiz', plate: 'MVN-826-D', fleet: 'Distribuidora Valle Azul', project: PROJECTS[1]!, date: '2026-11-19', weeklyRate: 11800, status: 'placed' },
  { id: 'c11', driver: 'Héctor Arellano Pons', plate: 'KSA-159-B', fleet: 'Transportes Aguilar del Norte', project: PROJECTS[2]!, date: '2026-11-18', weeklyRate: 13250, status: 'cancelled' },
  { id: 'c12', driver: 'Marisol Treviño Gil', plate: 'NDE-374-A', fleet: 'Logística Cumbres', project: PROJECTS[0]!, date: '2026-11-17', weeklyRate: 12400, status: 'placed' },
  { id: 'c13', driver: 'Fausto Villaseñor Cano', plate: 'LKP-208-E', fleet: 'Fletes Sierra Madre', project: PROJECTS[3]!, date: '2026-11-16', weeklyRate: 14100, status: 'placed' },
  { id: 'c14', driver: 'Abril Domínguez Paz', plate: 'MWB-441-C', fleet: 'Ruta Dorada', project: PROJECTS[1]!, date: '2026-11-14', weeklyRate: 11800, status: 'placed' },
  { id: 'c15', driver: 'Ismael Contreras León', plate: 'KTQ-690-D', fleet: 'Distribuidora Valle Azul', project: PROJECTS[2]!, date: '2026-11-13', weeklyRate: 13250, status: 'pending' },
  { id: 'c16', driver: 'Regina Cabrera Olvera', plate: 'NFJ-117-B', fleet: 'Transportes Aguilar del Norte', project: PROJECTS[0]!, date: '2026-11-12', weeklyRate: 12400, status: 'placed' },
  { id: 'c17', driver: 'Tadeo Manzano Ferrer', plate: 'LNC-503-A', fleet: 'Logística Cumbres', project: PROJECTS[3]!, date: '2026-11-10', weeklyRate: 14100, status: 'placed' },
  { id: 'c18', driver: 'Yazmín Ochoa Beltrán', plate: 'MGZ-762-E', fleet: 'Ruta Dorada', project: PROJECTS[1]!, date: '2026-11-09', weeklyRate: 11800, status: 'cancelled' },
];

// ------------------------------------------------------------------ Bandeja

export interface ChatMessage {
  kind: 'message';
  id: string;
  /** `bot` is the assistant. It never looks like a person. */
  from: 'fleet' | 'team' | 'bot';
  author: string;
  text: string;
  time: string;
}

/** A case event inside the thread. It is a centred line, not a bubble. */
export interface ChatEvent {
  kind: 'event';
  id: string;
  label: string;
  caseTitle: string;
  time: string;
}

export type ChatItem = ChatMessage | ChatEvent;

export interface FleetCase {
  id: string;
  title: string;
  reason: string;
  amount: number;
  opened: string;
  owner: string;
  status: 'open' | 'answered';
}

/** Who must move next: we reply, we work the record, or the fleet answers. */
export type NextStep = 'reply' | 'work' | 'fleet';
export type Speaker = 'Flota' | 'Soporte' | 'Asistente';

export interface InboxFleet {
  id: string;
  name: string;
  rfc: string;
  city: string;
  lastMessage: string;
  lastSeen: string;
  nextStep: NextStep;
  lastSpeaker: Speaker;
  /** Urgency shows only when the next step is ours. Null when it is `fleet`. */
  urgency: 'danger' | 'warning' | null;
  signal: string | null;
  openCases: number;
  openChats: number;
  owner: string | null;
  messages: ChatItem[];
  cases: FleetCase[];
  profile: { regime: string; units: number; balance: number; since: string; contact: string; phone: string };
}

export const INBOX_PEOPLE = ['Ana Ruiz', 'Mariana Lozano', 'Diego Salas'];

const MARIANA = 'Mariana Lozano';
const msg = (
  id: string,
  from: ChatMessage['from'],
  author: string,
  text: string,
  time: string,
): ChatMessage => ({ kind: 'message', id, from, author, text, time });

export const INBOX_FLEETS: InboxFleet[] = [
  {
    id: 'f01', name: 'Transportes Aguilar del Norte', rfc: 'TAN180412KP3', city: 'Monterrey, NL',
    lastMessage: 'Ya subimos la constancia de situación fiscal, ¿pueden revisarla?', lastSeen: 'hace 12 min',
    nextStep: 'reply', lastSpeaker: 'Flota', urgency: 'danger', signal: 'Antigüedad >24 h',
    openCases: 2, openChats: 1, owner: 'Mariana Lozano',
    messages: [
      msg('m1', 'team', MARIANA, 'Hola, el pago de esta semana quedó retenido porque falta la constancia de situación fiscal vigente.', '24 nov, 09:14'),
      msg('m2', 'team', MARIANA, 'Puedes subirla en el portal, en la sección de documentos.', '24 nov, 09:15'),
      msg('m3', 'fleet', 'Roberto Aguilar', 'Buen día. La actualizamos ayer en el portal, ¿se ve ya?', '24 nov, 10:02'),
      { kind: 'event', id: 'e1', label: 'Aclaración abierta', caseTitle: 'Pago retenido semana 47', time: '10:05' },
      msg('m4', 'bot', 'Asistente', 'Abrí una aclaración con Finanzas para revisar tu constancia. Te aviso aquí cuando haya respuesta.', '24 nov, 10:06'),
      msg('m5', 'team', MARIANA, 'Todavía aparece la de octubre. Súbela otra vez en formato PDF, por favor.', '24 nov, 10:20'),
      msg('m6', 'fleet', 'Roberto Aguilar', 'Ya subimos la constancia de situación fiscal, ¿pueden revisarla?', '24 nov, 11:48'),
    ],
    cases: [
      { id: 'a1', title: 'Pago retenido semana 47', reason: 'Falta constancia de situación fiscal vigente', amount: 86400, opened: '2026-11-24', owner: 'Mariana Lozano', status: 'open' },
      { id: 'a2', title: 'Descuento por siniestro', reason: 'La flota pide revisar el monto del deducible', amount: 4200, opened: '2026-11-17', owner: 'Mariana Lozano', status: 'open' },
    ],
    profile: { regime: '601 General de ley', units: 18, balance: 86400, since: '2025-02-10', contact: 'Roberto Aguilar', phone: '81 5550 0142' },
  },
  {
    id: 'f02', name: 'Logística Cumbres', rfc: 'LCU200918HM6', city: 'Querétaro, QRO',
    lastMessage: 'Necesitamos mover la fecha del primer cobro del plan.', lastSeen: 'hace 1 h',
    nextStep: 'reply', lastSpeaker: 'Flota', urgency: 'danger', signal: 'Vencida hace 2 h',
    openCases: 1, openChats: 1, owner: null,
    messages: [msg('m1', 'fleet', 'Sofía Cumbres', 'Necesitamos mover la fecha del primer cobro del plan.', '24 nov, 10:41')],
    cases: [{ id: 'a1', title: 'Cambio de fecha de plan', reason: 'Pide mover el primer cobro al 7 dic 2026', amount: 18000, opened: '2026-11-24', owner: 'Sin asignar', status: 'open' }],
    profile: { regime: '601 General de ley', units: 9, balance: 18000, since: '2025-06-03', contact: 'Sofía Cumbres', phone: '442 555 0178' },
  },
  {
    id: 'f04', name: 'Ruta Dorada', rfc: 'RDO170722LB9', city: 'Guadalajara, JAL',
    lastMessage: 'Nos faltó una unidad en la ruta del lunes, avisamos con tiempo.', lastSeen: 'hace 5 h',
    nextStep: 'reply', lastSpeaker: 'Flota', urgency: 'warning', signal: 'Responder en 12 min',
    openCases: 1, openChats: 1, owner: 'Ana Ruiz',
    messages: [msg('m1', 'fleet', 'Camila Dorada', 'Nos faltó una unidad en la ruta del lunes, avisamos con tiempo.', '24 nov, 06:50')],
    cases: [{ id: 'a1', title: 'Cargo por ruta no cubierta', reason: 'La flota avisó la baja antes de las 18:00', amount: 3500, opened: '2026-11-23', owner: 'Ana Ruiz', status: 'open' }],
    profile: { regime: '601 General de ley', units: 22, balance: 3500, since: '2024-11-05', contact: 'Camila Dorada', phone: '33 5550 0163' },
  },
  {
    id: 'f03', name: 'Fletes Sierra Madre', rfc: 'FSM190305QZ1', city: 'Saltillo, COA',
    lastMessage: 'Estamos revisando el desglose de cargos con Finanzas.', lastSeen: 'hace 3 h',
    nextStep: 'work', lastSpeaker: 'Soporte', urgency: null, signal: null,
    openCases: 1, openChats: 1, owner: 'Mariana Lozano',
    messages: [
      msg('m1', 'fleet', 'Ernesto Sierra', '¿Nos pueden explicar los cargos de la semana 46?', '24 nov, 07:30'),
      msg('m2', 'team', MARIANA, 'Estamos revisando el desglose de cargos con Finanzas.', '24 nov, 08:05'),
    ],
    cases: [{ id: 'a1', title: 'Revisión de cargos semana 46', reason: 'La flota pide el desglose de los cargos', amount: 7350, opened: '2026-11-24', owner: 'Mariana Lozano', status: 'open' }],
    profile: { regime: '626 RESICO', units: 12, balance: 0, since: '2025-03-21', contact: 'Ernesto Sierra', phone: '844 555 0119' },
  },
  {
    id: 'f05', name: 'Distribuidora Valle Azul', rfc: 'DVA210114TN2', city: 'Puebla, PUE',
    lastMessage: 'Ya avisé a Finanzas. Te confirmo el saldo el jueves.', lastSeen: 'ayer',
    nextStep: 'work', lastSpeaker: 'Asistente', urgency: null, signal: null,
    openCases: 0, openChats: 1, owner: 'Diego Salas',
    messages: [
      msg('m1', 'fleet', 'Andrés Valle', '¿Pueden revisar mi saldo a cargo?', '23 nov, 17:12'),
      msg('m2', 'bot', 'Asistente', 'Ya avisé a Finanzas. Te confirmo el saldo el jueves.', '23 nov, 17:13'),
    ],
    cases: [], profile: { regime: '601 General de ley', units: 7, balance: 12400, since: '2025-08-18', contact: 'Andrés Valle', phone: '222 555 0125' },
  },
  {
    id: 'f06', name: 'Autotransportes Peña Blanca', rfc: 'APB160830DK4', city: 'León, GTO',
    lastMessage: 'Adjunto el comprobante del depósito.', lastSeen: 'ayer',
    nextStep: 'work', lastSpeaker: 'Flota', urgency: null, signal: null,
    openCases: 0, openChats: 1, owner: null,
    messages: [msg('m1', 'fleet', 'Lucía Peña', 'Adjunto el comprobante del depósito.', '23 nov, 15:40')],
    cases: [], profile: { regime: '601 General de ley', units: 15, balance: 0, since: '2024-09-12', contact: 'Lucía Peña', phone: '477 555 0188' },
  },
  {
    id: 'f07', name: 'Carga Ligera del Bajío', rfc: 'CLB190611JU8', city: 'Celaya, GTO',
    lastMessage: 'Te confirmamos el pago en cuanto Finanzas lo libere.', lastSeen: 'hace 2 d',
    nextStep: 'fleet', lastSpeaker: 'Soporte', urgency: null, signal: null,
    openCases: 0, openChats: 1, owner: 'Ana Ruiz',
    messages: [msg('m1', 'team', MARIANA, 'Te confirmamos el pago en cuanto Finanzas lo libere.', '22 nov, 12:20')],
    cases: [], profile: { regime: '626 RESICO', units: 5, balance: 0, since: '2025-10-01', contact: 'Tomás Ledesma', phone: '461 555 0191' },
  },
  {
    id: 'f08', name: 'Transportes Montes y Hnos.', rfc: 'TMH150204AB7', city: 'Toluca, MEX',
    lastMessage: 'Corrige el RFC en el portal y avísanos.', lastSeen: 'hace 2 d',
    nextStep: 'fleet', lastSpeaker: 'Soporte', urgency: null, signal: null,
    openCases: 1, openChats: 1, owner: 'Diego Salas',
    messages: [msg('m1', 'team', MARIANA, 'Corrige el RFC en el portal y avísanos.', '22 nov, 09:05')],
    cases: [{ id: 'a1', title: 'RFC con error', reason: 'El RFC del portal no coincide con la constancia', amount: 0, opened: '2026-11-22', owner: 'Diego Salas', status: 'open' }],
    profile: { regime: '601 General de ley', units: 11, balance: 0, since: '2024-12-09', contact: 'Beatriz Montes', phone: '722 555 0134' },
  },
  {
    id: 'f09', name: 'Fletes Rápidos del Pacífico', rfc: 'FRP180925MC5', city: 'Mazatlán, SIN',
    lastMessage: 'El pago de la semana 46 cae el jueves.', lastSeen: 'hace 3 d',
    nextStep: 'fleet', lastSpeaker: 'Asistente', urgency: null, signal: null,
    openCases: 0, openChats: 1, owner: null,
    messages: [msg('m1', 'bot', 'Asistente', 'El pago de la semana 46 cae el jueves.', '21 nov, 18:44')],
    cases: [], profile: { regime: '601 General de ley', units: 8, balance: 0, since: '2025-04-22', contact: 'Valeria Ochoa', phone: '669 555 0107' },
  },
  {
    id: 'f10', name: 'Grupo Logístico Mezquital', rfc: 'GLM200302PX0', city: 'Durango, DGO',
    lastMessage: 'Te avisamos del cambio de horario de la ruta.', lastSeen: 'hace 3 d',
    nextStep: 'fleet', lastSpeaker: 'Soporte', urgency: null, signal: null,
    openCases: 0, openChats: 1, owner: 'Ana Ruiz',
    messages: [msg('m1', 'team', MARIANA, 'Te avisamos del cambio de horario de la ruta.', '21 nov, 11:15')],
    cases: [], profile: { regime: '626 RESICO', units: 6, balance: 0, since: '2025-07-14', contact: 'Iván Mezquital', phone: '618 555 0152' },
  },
  {
    id: 'f11', name: 'Camiones del Altiplano', rfc: 'CAL140516RE3', city: 'San Luis Potosí, SLP',
    lastMessage: 'Manda las placas nuevas por correo, por favor.', lastSeen: 'hace 4 d',
    nextStep: 'fleet', lastSpeaker: 'Soporte', urgency: null, signal: null,
    openCases: 1, openChats: 1, owner: 'Diego Salas',
    messages: [msg('m1', 'team', MARIANA, 'Manda las placas nuevas por correo, por favor.', '20 nov, 16:02')],
    cases: [{ id: 'a1', title: 'Cambio de placas', reason: 'Falta registrar las placas nuevas de dos unidades', amount: 0, opened: '2026-11-20', owner: 'Diego Salas', status: 'open' }],
    profile: { regime: '601 General de ley', units: 14, balance: 0, since: '2024-10-28', contact: 'Mateo Rangel', phone: '444 555 0176' },
  },
  {
    id: 'f12', name: 'Mudanzas y Fletes Zaragoza', rfc: 'MFZ170419QH6', city: 'Veracruz, VER',
    lastMessage: 'Te enviamos el convenio para firma.', lastSeen: 'hace 5 d',
    nextStep: 'fleet', lastSpeaker: 'Asistente', urgency: null, signal: null,
    openCases: 0, openChats: 1, owner: null,
    messages: [msg('m1', 'bot', 'Asistente', 'Te enviamos el convenio para firma.', '19 nov, 13:30')],
    cases: [], profile: { regime: '626 RESICO', units: 4, balance: 0, since: '2025-09-02', contact: 'Paola Zaragoza', phone: '229 555 0113' },
  },
  {
    id: 'f13', name: 'Transportes Hidalgo Express', rfc: 'THE190827SL1', city: 'Pachuca, HGO',
    lastMessage: 'Necesitamos los datos de la cuenta nueva.', lastSeen: 'hace 6 d',
    nextStep: 'fleet', lastSpeaker: 'Soporte', urgency: null, signal: null,
    openCases: 0, openChats: 1, owner: 'Ana Ruiz',
    messages: [msg('m1', 'team', MARIANA, 'Necesitamos los datos de la cuenta nueva.', '18 nov, 10:10')],
    cases: [], profile: { regime: '601 General de ley', units: 10, balance: 0, since: '2025-01-30', contact: 'Ricardo Hidalgo', phone: '771 555 0146' },
  },
  {
    id: 'f14', name: 'Fletes y Mensajería Tamaulipas', rfc: 'FMT210708VD9', city: 'Reynosa, TAM',
    lastMessage: 'Quedó aclarado el cargo. Avísanos si hay dudas.', lastSeen: '17 nov 2026',
    nextStep: 'fleet', lastSpeaker: 'Soporte', urgency: null, signal: null,
    openCases: 0, openChats: 1, owner: null,
    messages: [msg('m1', 'team', MARIANA, 'Quedó aclarado el cargo. Avísanos si hay dudas.', '17 nov, 14:25')],
    cases: [], profile: { regime: '626 RESICO', units: 3, balance: 0, since: '2026-01-19', contact: 'Diana Cantú', phone: '899 555 0121' },
  },
];

// -------------------------------------------------------------------- Flota

export const FLEET_RECORD = {
  name: 'Transportes Aguilar del Norte',
  rfc: 'TAN180412KP3',
  regime: '601 General de ley',
  zip: '64000',
  city: 'Monterrey, Nuevo León',
  since: '2025-02-10',
  units: 18,
  balance: 86400,
  clabe: '012 180 00112233445 6',
  contact: 'Roberto Aguilar · 81 5550 0142',
  note: 'El pago semanal se deposita los jueves. La flota factura por unidad y entrega el CFDI de pago junto con la constancia fiscal vigente.',
};

export interface FleetRoute {
  id: string; route: string; project: string; date: string; units: number; amount: number; status: 'done' | 'open';
}
export const FLEET_ROUTES: FleetRoute[] = [
  { id: 'r1', route: 'MTY-NOR-0412', project: PROJECTS[0]!, date: '2026-11-24', units: 6, amount: 24600, status: 'open' },
  { id: 'r2', route: 'MTY-NOR-0409', project: PROJECTS[0]!, date: '2026-11-23', units: 6, amount: 24600, status: 'done' },
  { id: 'r3', route: 'MTY-CDI-0187', project: PROJECTS[2]!, date: '2026-11-22', units: 4, amount: 19800, status: 'done' },
  { id: 'r4', route: 'MTY-EXP-0233', project: PROJECTS[3]!, date: '2026-11-21', units: 3, amount: 15900, status: 'done' },
  { id: 'r5', route: 'MTY-NOR-0401', project: PROJECTS[0]!, date: '2026-11-20', units: 6, amount: 24600, status: 'done' },
  { id: 'r6', route: 'MTY-CDI-0179', project: PROJECTS[2]!, date: '2026-11-19', units: 4, amount: 19800, status: 'done' },
];

export interface FleetCharge {
  id: string; concept: string; week: string; date: string; amount: number; status: 'applied' | 'pending';
}
export const FLEET_CHARGES: FleetCharge[] = [
  { id: 'g1', concept: 'Deducible por siniestro', week: 'Semana 46', date: '2026-11-17', amount: 4200, status: 'pending' },
  { id: 'g2', concept: 'Uniformes y chalecos', week: 'Semana 45', date: '2026-11-10', amount: 1850, status: 'applied' },
  { id: 'g3', concept: 'Ruta no cubierta', week: 'Semana 44', date: '2026-11-03', amount: 3500, status: 'applied' },
  { id: 'g4', concept: 'Seguro de carga', week: 'Semana 43', date: '2026-10-27', amount: 2900, status: 'applied' },
];

export interface FleetPayment {
  id: string; week: string; date: string; amount: number; status: 'paid' | 'held';
}
export const FLEET_PAYMENTS: FleetPayment[] = [
  { id: 'p1', week: 'Semana 47', date: '2026-11-26', amount: 86400, status: 'held' },
  { id: 'p2', week: 'Semana 46', date: '2026-11-19', amount: 91250, status: 'paid' },
  { id: 'p3', week: 'Semana 45', date: '2026-11-12', amount: 88700, status: 'paid' },
  { id: 'p4', week: 'Semana 44', date: '2026-11-05', amount: 90100, status: 'paid' },
];

// ------------------------------------------------------------ Saldos a cargo

export type BalanceStatus = 'none' | 'overdue' | 'clarifying';

export interface Balance {
  id: string;
  fleet: string;
  concept: string;
  week: string;
  amount: number;
  age: number;
  status: BalanceStatus;
}

export const BALANCE_STATUS: Record<BalanceStatus, { label: string; tone: 'neutral' | 'danger' | 'warning' }> = {
  none: { label: 'Sin plan', tone: 'neutral' },
  overdue: { label: 'Vencido', tone: 'danger' },
  clarifying: { label: 'En aclaración', tone: 'warning' },
};

export const BALANCES: Balance[] = [
  { id: 's1', fleet: 'Ruta Dorada', concept: 'Cargo por ruta no cubierta', week: 'Semana 46', amount: 3500, age: 3, status: 'none' },
  { id: 's2', fleet: 'Fletes Sierra Madre', concept: 'Deducible por siniestro', week: 'Semana 43', amount: 28400, age: 31, status: 'overdue' },
  { id: 's3', fleet: 'Transportes Aguilar del Norte', concept: 'Deducible por siniestro', week: 'Semana 46', amount: 4200, age: 9, status: 'clarifying' },
  { id: 's4', fleet: 'Logística Cumbres', concept: 'Anticipo de combustible', week: 'Semana 45', amount: 18000, age: 14, status: 'none' },
  { id: 's5', fleet: 'Distribuidora Valle Azul', concept: 'Sobrepago de semana 44', week: 'Semana 44', amount: 12400, age: 22, status: 'none' },
  { id: 's6', fleet: 'Autotransportes Peña Blanca', concept: 'Uniformes y chalecos', week: 'Semana 46', amount: 5850, age: 6, status: 'none' },
  { id: 's7', fleet: 'Camiones del Altiplano', concept: 'Anticipo de combustible', week: 'Semana 41', amount: 46200, age: 45, status: 'overdue' },
  { id: 's8', fleet: 'Carga Ligera del Bajío', concept: 'Seguro de carga', week: 'Semana 46', amount: 2900, age: 4, status: 'none' },
];

export interface PaymentPlan {
  id: string;
  fleet: string;
  weekly: number;
  progress: string;
  next: string;
  status: 'active' | 'late';
}
export const PAYMENT_PLANS: PaymentPlan[] = [
  { id: 'pl1', fleet: 'Mudanzas y Fletes Zaragoza', weekly: 1500, progress: '4 de 12', next: '2026-11-27', status: 'active' },
  { id: 'pl2', fleet: 'Transportes Montes y Hnos.', weekly: 2400, progress: '7 de 10', next: '2026-11-27', status: 'active' },
  { id: 'pl3', fleet: 'Fletes Rápidos del Pacífico', weekly: 900, progress: '2 de 8', next: '2026-11-27', status: 'active' },
  { id: 'pl4', fleet: 'Grupo Logístico Mezquital', weekly: 1800, progress: '9 de 12', next: '2026-11-20', status: 'late' },
  { id: 'pl5', fleet: 'Transportes Hidalgo Express', weekly: 2100, progress: '1 de 6', next: '2026-11-27', status: 'active' },
];
