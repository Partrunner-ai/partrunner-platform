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
  id: string;
  from: 'fleet' | 'team';
  author: string;
  text: string;
  time: string;
}

export interface FleetCase {
  id: string;
  title: string;
  reason: string;
  amount: number;
  opened: string;
  owner: string;
  status: 'open' | 'answered';
}

export interface InboxFleet {
  id: string;
  name: string;
  rfc: string;
  city: string;
  lastMessage: string;
  lastSeen: string;
  unread: number;
  messages: ChatMessage[];
  cases: FleetCase[];
  profile: { regime: string; units: number; balance: number; since: string; contact: string; phone: string };
}

const MARIANA = 'Mariana (Finanzas)';

export const INBOX_FLEETS: InboxFleet[] = [
  {
    id: 'f01', name: 'Transportes Aguilar del Norte', rfc: 'TAN180412KP3', city: 'Monterrey, NL',
    lastMessage: 'Ya subimos la constancia de situación fiscal, ¿pueden revisarla?', lastSeen: 'hace 12 min', unread: 2,
    messages: [
      { id: 'm1', from: 'team', author: MARIANA, text: 'Hola, el pago de esta semana quedó retenido porque falta la constancia de situación fiscal vigente.', time: '24 nov 2026, 09:14' },
      { id: 'm2', from: 'fleet', author: 'Roberto Aguilar', text: 'Buen día. La actualizamos ayer en el portal, ¿se ve ya?', time: '24 nov 2026, 10:02' },
      { id: 'm3', from: 'team', author: MARIANA, text: 'Todavía aparece la de octubre. Súbela otra vez en formato PDF, por favor.', time: '24 nov 2026, 10:20' },
      { id: 'm4', from: 'fleet', author: 'Roberto Aguilar', text: 'Ya subimos la constancia de situación fiscal, ¿pueden revisarla?', time: '24 nov 2026, 11:48' },
    ],
    cases: [
      { id: 'a1', title: 'Pago retenido semana 47', reason: 'Falta constancia de situación fiscal vigente', amount: 86400, opened: '2026-11-24', owner: 'Mariana Lozano', status: 'open' },
      { id: 'a2', title: 'Descuento por siniestro', reason: 'La flota pide revisar el monto del deducible', amount: 4200, opened: '2026-11-17', owner: 'Mariana Lozano', status: 'answered' },
    ],
    profile: { regime: '601 General de ley', units: 18, balance: 86400, since: '2025-02-10', contact: 'Roberto Aguilar', phone: '81 5550 0142' },
  },
  {
    id: 'f02', name: 'Logística Cumbres', rfc: 'LCU200918HM6', city: 'Querétaro, QRO',
    lastMessage: 'Necesitamos mover la fecha del primer cobro del plan.', lastSeen: 'hace 1 h', unread: 1,
    messages: [
      { id: 'm1', from: 'fleet', author: 'Sofía Cumbres', text: 'Necesitamos mover la fecha del primer cobro del plan.', time: '24 nov 2026, 10:41' },
    ],
    cases: [{ id: 'a1', title: 'Cambio de fecha de plan', reason: 'Pide mover el primer cobro al 7 dic 2026', amount: 18000, opened: '2026-11-24', owner: 'Sin asignar', status: 'open' }],
    profile: { regime: '601 General de ley', units: 9, balance: 18000, since: '2025-06-03', contact: 'Sofía Cumbres', phone: '442 555 0178' },
  },
  {
    id: 'f03', name: 'Fletes Sierra Madre', rfc: 'FSM190305QZ1', city: 'Saltillo, COA',
    lastMessage: 'Gracias, ya vimos el desglose de cargos.', lastSeen: 'hace 3 h', unread: 0,
    messages: [
      { id: 'm1', from: 'team', author: MARIANA, text: 'Te comparto el desglose de cargos de la semana 46.', time: '24 nov 2026, 07:30' },
      { id: 'm2', from: 'fleet', author: 'Ernesto Sierra', text: 'Gracias, ya vimos el desglose de cargos.', time: '24 nov 2026, 08:05' },
    ],
    cases: [],
    profile: { regime: '626 RESICO', units: 12, balance: 0, since: '2025-03-21', contact: 'Ernesto Sierra', phone: '844 555 0119' },
  },
  {
    id: 'f04', name: 'Ruta Dorada', rfc: 'RDO170722LB9', city: 'Guadalajara, JAL',
    lastMessage: 'Nos faltó una unidad en la ruta del lunes, avisamos con tiempo.', lastSeen: 'hace 5 h', unread: 1,
    messages: [
      { id: 'm1', from: 'fleet', author: 'Camila Dorada', text: 'Nos faltó una unidad en la ruta del lunes, avisamos con tiempo.', time: '24 nov 2026, 06:50' },
    ],
    cases: [{ id: 'a1', title: 'Cargo por ruta no cubierta', reason: 'La flota avisó la baja antes de las 18:00', amount: 3500, opened: '2026-11-23', owner: 'Mariana Lozano', status: 'open' }],
    profile: { regime: '601 General de ley', units: 22, balance: 3500, since: '2024-11-05', contact: 'Camila Dorada', phone: '33 5550 0163' },
  },
  {
    id: 'f05', name: 'Distribuidora Valle Azul', rfc: 'DVA210114TN2', city: 'Puebla, PUE',
    lastMessage: 'Quedamos para revisar el saldo el jueves.', lastSeen: 'ayer', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Andrés Valle', text: 'Quedamos para revisar el saldo el jueves.', time: '23 nov 2026, 17:12' }],
    cases: [], profile: { regime: '601 General de ley', units: 7, balance: 12400, since: '2025-08-18', contact: 'Andrés Valle', phone: '222 555 0125' },
  },
  {
    id: 'f06', name: 'Autotransportes Peña Blanca', rfc: 'APB160830DK4', city: 'León, GTO',
    lastMessage: 'Adjunto el comprobante del depósito.', lastSeen: 'ayer', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Lucía Peña', text: 'Adjunto el comprobante del depósito.', time: '23 nov 2026, 15:40' }],
    cases: [], profile: { regime: '601 General de ley', units: 15, balance: 0, since: '2024-09-12', contact: 'Lucía Peña', phone: '477 555 0188' },
  },
  {
    id: 'f07', name: 'Carga Ligera del Bajío', rfc: 'CLB190611JU8', city: 'Celaya, GTO',
    lastMessage: 'Perfecto, esperamos la confirmación.', lastSeen: 'hace 2 d', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Tomás Ledesma', text: 'Perfecto, esperamos la confirmación.', time: '22 nov 2026, 12:20' }],
    cases: [], profile: { regime: '626 RESICO', units: 5, balance: 0, since: '2025-10-01', contact: 'Tomás Ledesma', phone: '461 555 0191' },
  },
  {
    id: 'f08', name: 'Transportes Montes y Hnos.', rfc: 'TMH150204AB7', city: 'Toluca, MEX',
    lastMessage: 'Ya quedó corregido el RFC en el portal.', lastSeen: 'hace 2 d', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Beatriz Montes', text: 'Ya quedó corregido el RFC en el portal.', time: '22 nov 2026, 09:05' }],
    cases: [], profile: { regime: '601 General de ley', units: 11, balance: 0, since: '2024-12-09', contact: 'Beatriz Montes', phone: '722 555 0134' },
  },
  {
    id: 'f09', name: 'Fletes Rápidos del Pacífico', rfc: 'FRP180925MC5', city: 'Mazatlán, SIN',
    lastMessage: '¿Cuándo cae el pago de la semana 46?', lastSeen: 'hace 3 d', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Valeria Ochoa', text: '¿Cuándo cae el pago de la semana 46?', time: '21 nov 2026, 18:44' }],
    cases: [], profile: { regime: '601 General de ley', units: 8, balance: 0, since: '2025-04-22', contact: 'Valeria Ochoa', phone: '669 555 0107' },
  },
  {
    id: 'f10', name: 'Grupo Logístico Mezquital', rfc: 'GLM200302PX0', city: 'Durango, DGO',
    lastMessage: 'Entendido, gracias por avisar.', lastSeen: 'hace 3 d', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Iván Mezquital', text: 'Entendido, gracias por avisar.', time: '21 nov 2026, 11:15' }],
    cases: [], profile: { regime: '626 RESICO', units: 6, balance: 0, since: '2025-07-14', contact: 'Iván Mezquital', phone: '618 555 0152' },
  },
  {
    id: 'f11', name: 'Camiones del Altiplano', rfc: 'CAL140516RE3', city: 'San Luis Potosí, SLP',
    lastMessage: 'Les mandamos las placas nuevas por correo.', lastSeen: 'hace 4 d', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Mateo Rangel', text: 'Les mandamos las placas nuevas por correo.', time: '20 nov 2026, 16:02' }],
    cases: [], profile: { regime: '601 General de ley', units: 14, balance: 0, since: '2024-10-28', contact: 'Mateo Rangel', phone: '444 555 0176' },
  },
  {
    id: 'f12', name: 'Mudanzas y Fletes Zaragoza', rfc: 'MFZ170419QH6', city: 'Veracruz, VER',
    lastMessage: 'Listo, ya firmamos el convenio.', lastSeen: 'hace 5 d', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Paola Zaragoza', text: 'Listo, ya firmamos el convenio.', time: '19 nov 2026, 13:30' }],
    cases: [], profile: { regime: '626 RESICO', units: 4, balance: 0, since: '2025-09-02', contact: 'Paola Zaragoza', phone: '229 555 0113' },
  },
  {
    id: 'f13', name: 'Transportes Hidalgo Express', rfc: 'THE190827SL1', city: 'Pachuca, HGO',
    lastMessage: 'Quedamos pendientes del cambio de cuenta.', lastSeen: 'hace 6 d', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Ricardo Hidalgo', text: 'Quedamos pendientes del cambio de cuenta.', time: '18 nov 2026, 10:10' }],
    cases: [], profile: { regime: '601 General de ley', units: 10, balance: 0, since: '2025-01-30', contact: 'Ricardo Hidalgo', phone: '771 555 0146' },
  },
  {
    id: 'f14', name: 'Fletes y Mensajería Tamaulipas', rfc: 'FMT210708VD9', city: 'Reynosa, TAM',
    lastMessage: 'Gracias por la aclaración.', lastSeen: '17 nov 2026', unread: 0,
    messages: [{ id: 'm1', from: 'fleet', author: 'Diana Cantú', text: 'Gracias por la aclaración.', time: '17 nov 2026, 14:25' }],
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
