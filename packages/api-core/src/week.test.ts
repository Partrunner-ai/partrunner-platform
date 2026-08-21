import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cdmxMidnightUtc,
  getCurrentIsoWeekCdmx,
  getIsoWeekDateRange,
  isoWeekOf,
  isoWeekToMonday,
  shiftIsoWeek,
} from './week';

afterEach(() => {
  vi.useRealTimers();
});

const utc = (s: string) => new Date(`${s}T00:00:00Z`);

describe('isoWeekOf', () => {
  // The Thursday pivot is the whole reason ISO weeks are not "day-of-year / 7".
  it.each([
    ['2026-01-01', 1, 2026, 'Thursday — pivots its own year'],
    ['2025-12-29', 1, 2026, 'Monday belonging to NEXT year’s week 1'],
    ['2025-12-28', 52, 2025, 'the Sunday before it, still last year'],
    ['2021-01-01', 53, 2020, 'Friday belonging to the PREVIOUS year’s week 53'],
    ['2021-01-04', 1, 2021, 'first Monday of 2021'],
    ['2026-08-08', 32, 2026, 'an ordinary mid-year Saturday'],
  ])('%s → week %i of %i (%s)', (date, week, year) => {
    expect(isoWeekOf(utc(date))).toEqual({ week, year });
  });

  it('is unaffected by how the Date was constructed', () => {
    const fromUtc = new Date(Date.UTC(2026, 7, 8));
    const fromIso = new Date('2026-08-08T00:00:00Z');
    expect(isoWeekOf(fromUtc)).toEqual(isoWeekOf(fromIso));
  });
});

describe('isoWeekToMonday', () => {
  it.each([
    [1, 2026, '2025-12-29'],
    [32, 2026, '2026-08-03'],
    [53, 2020, '2020-12-28'],
    [1, 2021, '2021-01-04'],
  ])('week %i of %i starts %s', (week, year, monday) => {
    expect(isoWeekToMonday(week, year).toISOString().slice(0, 10)).toBe(monday);
  });

  it('round-trips with isoWeekOf', () => {
    for (const [week, year] of [[1, 2026], [32, 2026], [53, 2020], [52, 2025]] as const) {
      expect(isoWeekOf(isoWeekToMonday(week, year))).toEqual({ week, year });
    }
  });
});

describe('shiftIsoWeek', () => {
  it('crosses a year boundary forwards', () => {
    expect(shiftIsoWeek(52, 2025, 1)).toEqual({ week: 1, year: 2026 });
  });

  it('crosses a year boundary backwards', () => {
    expect(shiftIsoWeek(1, 2026, -1)).toEqual({ week: 52, year: 2025 });
  });

  // A naive `week + n` produces week 54, or skips 53 entirely.
  it('handles 53-week years', () => {
    expect(shiftIsoWeek(52, 2020, 1)).toEqual({ week: 53, year: 2020 });
    expect(shiftIsoWeek(53, 2020, 1)).toEqual({ week: 1, year: 2021 });
    expect(shiftIsoWeek(1, 2021, -1)).toEqual({ week: 53, year: 2020 });
  });

  it('is reversible over long spans', () => {
    const there = shiftIsoWeek(32, 2026, -60);
    expect(shiftIsoWeek(there.week, there.year, 60)).toEqual({ week: 32, year: 2026 });
  });

  it('offset 0 is identity', () => {
    expect(shiftIsoWeek(32, 2026, 0)).toEqual({ week: 32, year: 2026 });
  });
});

describe('getCurrentIsoWeekCdmx', () => {
  it('uses the CDMX calendar date, not the UTC one', () => {
    // Sunday 23:00 CDMX = Monday 05:00 UTC. UTC has rolled into week 33;
    // CDMX has not. Billing a route by UTC here would file it a week late.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T05:00:00Z'));

    expect(getCurrentIsoWeekCdmx()).toEqual({ week: 32, year: 2026 });
    expect(isoWeekOf(new Date('2026-08-10T05:00:00Z'))).toEqual({ week: 33, year: 2026 });
  });

  it('rolls over at CDMX midnight', () => {
    // 06:00 UTC on the same day = 00:00 CDMX Monday → new week.
    expect(getCurrentIsoWeekCdmx(new Date('2026-08-10T06:00:00Z'))).toEqual({
      week: 33,
      year: 2026,
    });
  });

  it('accepts an explicit instant', () => {
    expect(getCurrentIsoWeekCdmx(new Date('2026-08-08T18:00:00Z'))).toEqual({
      week: 32,
      year: 2026,
    });
  });
});

describe('getIsoWeekDateRange', () => {
  it('spans Monday to Sunday', () => {
    expect(getIsoWeekDateRange(32, 2026)).toEqual({
      startDate: '2026-08-03',
      endDate: '2026-08-09',
    });
  });

  it('spans a year boundary', () => {
    expect(getIsoWeekDateRange(1, 2026)).toEqual({
      startDate: '2025-12-29',
      endDate: '2026-01-04',
    });
  });
});

describe('cdmxMidnightUtc', () => {
  it('is 06:00 UTC, since CDMX is a fixed UTC−6', () => {
    expect(cdmxMidnightUtc(32, 2026).toISOString()).toBe('2026-08-03T06:00:00.000Z');
  });

  it('counts dayOffset from Monday', () => {
    expect(cdmxMidnightUtc(32, 2026, 1).toISOString()).toBe('2026-08-04T06:00:00.000Z');
    expect(cdmxMidnightUtc(32, 2026, 6).toISOString()).toBe('2026-08-09T06:00:00.000Z');
  });
});
