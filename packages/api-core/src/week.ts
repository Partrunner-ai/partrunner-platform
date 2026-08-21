/**
 * @partrunner-ai/api-core/week — ISO 8601 week arithmetic in America/Mexico_City.
 *
 * This is a **shared business rule**, not a utility. PartRunner bills, reports
 * and reconciles by ISO work week, so "which week is this?" has to mean the
 * same thing in every app. Two copies of this logic can silently disagree about
 * which reporting period contains a date. That is the reason it is shared; the line
 * count is not.
 *
 * What is deliberately NOT here: billing *policy*. Cutoff instants, the
 * Product-specific cutoff, editing, and queue policies remain in consuming
 * applications. Only calendar arithmetic is shared.
 *
 * All returned `Date` values are UTC instants.
 */

export const CDMX_TIMEZONE = 'America/Mexico_City';

/**
 * México abolished DST in 2022, so CDMX is a fixed UTC−6. Callers converting a
 * CDMX wall-clock time to UTC add this; if México ever reinstates DST this
 * constant is the single thing that has to change.
 */
export const CDMX_UTC_OFFSET_HOURS = 6;

export interface IsoWeek {
  week: number;
  year: number;
}

export interface IsoWeekRange {
  /** Monday, `YYYY-MM-DD`. */
  startDate: string;
  /** Sunday, `YYYY-MM-DD`. */
  endDate: string;
}

/**
 * ISO 8601 week and week-year of a date — Monday-based, with the year decided
 * by the week's Thursday. That pivot is what makes 2025-12-29 belong to week 1
 * of 2026 rather than week 53 of 2025.
 *
 * Reads the UTC components of the input, so it behaves identically whether the
 * `Date` was built from UTC or local parts.
 */
export function isoWeekOf(d: Date): IsoWeek {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Move to the Thursday of this week; its calendar year is the ISO week-year.
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, year: tmp.getUTCFullYear() };
}

/**
 * Monday (UTC midnight) of an ISO week.
 *
 * Anchored on January 4th, which is always in ISO week 1 by definition — the
 * one fixed point that makes this work without special-casing year boundaries.
 */
export function isoWeekToMonday(week: number, year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Sunday is 7, not 0.
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target;
}

/**
 * Add (or subtract) whole weeks, crossing year boundaries correctly — including
 * into and out of 53-week years, which a naive `week + n` gets wrong.
 */
export function shiftIsoWeek(week: number, year: number, offsetWeeks: number): IsoWeek {
  const monday = isoWeekToMonday(week, year);
  monday.setUTCDate(monday.getUTCDate() + offsetWeeks * 7);
  return isoWeekOf(monday);
}

/**
 * The ISO week it currently is *in CDMX*, which is not always the ISO week it
 * is in UTC: between 18:00 and 24:00 CDMX on a Sunday, UTC has already rolled
 * into Monday and the next week.
 *
 * Resolves the CDMX calendar date first, then takes its ISO week — anchoring at
 * midday UTC so no rounding can push the result onto an adjacent day.
 */
export function getCurrentIsoWeekCdmx(now: Date = new Date()): IsoWeek {
  const { year, month, day } = toCdmxDateParts(now);
  return isoWeekOf(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

function toCdmxDateParts(d: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CDMX_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Monday–Sunday calendar range of an ISO week, as `YYYY-MM-DD` strings. */
export function getIsoWeekDateRange(week: number, year: number): IsoWeekRange {
  const monday = isoWeekToMonday(week, year);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(monday), endDate: fmt(sunday) };
}

/**
 * Midnight CDMX of a given weekday within an ISO week, as a UTC instant.
 *
 * `dayOffset` counts from Monday: 0 Monday, 1 Tuesday, … 6 Sunday. Apps build
 * their own policy instants on top of this rather than each re-deriving the
 * offset conversion.
 */
export function cdmxMidnightUtc(week: number, year: number, dayOffset = 0): Date {
  const day = isoWeekToMonday(week, year);
  day.setUTCDate(day.getUTCDate() + dayOffset);
  day.setUTCHours(CDMX_UTC_OFFSET_HOURS, 0, 0, 0);
  return day;
}
