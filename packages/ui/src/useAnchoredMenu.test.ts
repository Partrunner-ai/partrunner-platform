import { describe, expect, it } from 'vitest';

import { anchorHorizontally, type HorizontalAnchorInput } from './useAnchoredMenu';

/** A wide fixed grid near the viewport edge must shift rather than shrink. */
const RIGHT_EDGE_GRID: HorizontalAnchorInput = {
  align: 'left',
  matchTriggerWidth: false,
  triggerLeft: 1677,
  triggerRight: 1727,
  triggerWidth: 50,
  measuredWidth: 320,
  viewportWidth: 1920,
  margin: 8,
};

describe('anchorHorizontally', () => {
  it('shifts a panel that does not fit beside its trigger instead of shrinking it', () => {
    const pos = anchorHorizontally(RIGHT_EDGE_GRID);

    // The whole point: the budget is the viewport, so 320px of calendar is allowed.
    expect(pos.maxWidth).toBeGreaterThanOrEqual(320);
    // And it is moved left far enough to actually show all 320.
    expect(pos.left! + RIGHT_EDGE_GRID.measuredWidth).toBeLessThanOrEqual(1920 - 8);
    expect(pos.left).toBe(1920 - 320 - 8);
  });

  it('leaves a panel that already fits exactly where the trigger is', () => {
    // The common case must stay untouched when no collision exists.
    const pos = anchorHorizontally({ ...RIGHT_EDGE_GRID, triggerLeft: 100, triggerRight: 150 });
    expect(pos.left).toBe(100);
  });

  it('never pushes a panel off the left edge, however wide it is', () => {
    // A panel wider than the viewport has no good answer; the margin is the floor.
    const pos = anchorHorizontally({ ...RIGHT_EDGE_GRID, measuredWidth: 5000 });
    expect(pos.left).toBe(8);
    expect(pos.maxWidth).toBe(1920 - 16);
  });

  describe('align: right', () => {
    const right: HorizontalAnchorInput = { ...RIGHT_EDGE_GRID, align: 'right' };

    it('anchors by the right edge rather than a computed left', () => {
      // Not cosmetic. `measuredWidth` falls back to the trigger's width on the first
      // compute of a fresh mount, so a `left` derived from it would misplace the panel
      // for a frame. Anchoring by `right` is correct before anything is measured.
      const pos = anchorHorizontally(right);
      expect(pos.right).toBe(1920 - 1727);
      expect(pos.left).toBeUndefined();
    });

    it('stops the panel from reaching past the left edge', () => {
      // Trigger near the left edge with content far wider than the space before it.
      const pos = anchorHorizontally({
        ...right,
        triggerLeft: 40,
        triggerRight: 90,
        measuredWidth: 600,
      });
      // left edge = viewport - right - width, and it must clear the margin.
      expect(1920 - pos.right! - 600).toBeGreaterThanOrEqual(8);
    });
  });

  describe('align: center', () => {
    it('centres on the trigger when there is room', () => {
      const pos = anchorHorizontally({
        ...RIGHT_EDGE_GRID,
        align: 'center',
        triggerLeft: 900,
        triggerRight: 950,
      });
      expect(pos.left).toBe(900 + 25 - 160);
    });

    it('keeps its existing clamp at both edges', () => {
      // This alignment already shifted rather than shrank; the refactor must not
      // change it, because it is the behaviour the other two were brought in line with.
      const near = anchorHorizontally({
        ...RIGHT_EDGE_GRID,
        align: 'center',
        triggerLeft: 0,
        triggerRight: 50,
      });
      expect(near.left).toBe(8);
      // Far enough right that the centred position would itself overflow: 1850 + 25 -
      // 160 = 1715, past the 1592 the panel may start at.
      const far = anchorHorizontally({
        ...RIGHT_EDGE_GRID,
        align: 'center',
        triggerLeft: 1850,
        triggerRight: 1900,
      });
      expect(far.left).toBe(1920 - 320 - 8);
    });
  });

  describe('matchTriggerWidth', () => {
    it('pins the width to the trigger, which is what a field-width panel wants', () => {
      const pos = anchorHorizontally({
        ...RIGHT_EDGE_GRID,
        matchTriggerWidth: true,
        triggerWidth: 400,
      });
      expect(pos.width).toBe(400);
      expect(pos.maxWidth).toBeUndefined();
    });

    it('still cannot exceed the viewport', () => {
      const pos = anchorHorizontally({
        ...RIGHT_EDGE_GRID,
        matchTriggerWidth: true,
        triggerWidth: 4000,
      });
      expect(pos.width).toBe(1920 - 16);
    });

    it('gives a content-sized panel the trigger width as a floor, not a ceiling', () => {
      const pos = anchorHorizontally({ ...RIGHT_EDGE_GRID, triggerWidth: 200 });
      expect(pos.minWidth).toBe(200);
      expect(pos.maxWidth).toBe(1920 - 16);
    });
  });

  it('survives a viewport narrower than the margins without going negative', () => {
    const pos = anchorHorizontally({ ...RIGHT_EDGE_GRID, viewportWidth: 10 });
    expect(pos.maxWidth).toBe(0);
    expect(pos.left).toBeGreaterThanOrEqual(0);
  });
});
