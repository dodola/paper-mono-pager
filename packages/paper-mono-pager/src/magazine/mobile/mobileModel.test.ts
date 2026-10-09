import { describe, expect, it } from 'vitest';
import {
  MOBILE_FRAME,
  MOBILE_CAMERA_Z,
  MOBILE_TUNING,
  mobileFrameAspect,
  mobileFov,
  claimsHorizontalSwipe,
  dragProgress,
  commitTarget,
  flipEase,
  holdTiming,
  smooth01,
  hash,
  pileLift,
  pileReach,
  buildCatchUp,
  catchUp,
  buildRadiusSpacing,
  computeSheetShape,
  bookOffset,
  sheetVisible,
  sheetRenderOrder,
  DEFAULT_SINGLE_PAGE_QUERY,
  MOBILE_CONTENT_EXTENT,
  MOBILE_FILL_MARGIN,
  MOBILE_LAYER_SCALE,
  mobileStageSize,
} from './mobileModel';

describe('mobile frame & camera', () => {
  it('frame aspect is width / height of the frame', () => {
    expect(mobileFrameAspect()).toBeCloseTo((1.22 + 0.34) / 2.4, 6);
  });

  it('fov is derived from the frame height at the fixed camera distance', () => {
    const expected = (2 * Math.atan(2.4 / 2 / MOBILE_CAMERA_Z) * 180) / Math.PI;
    expect(mobileFov()).toBeCloseTo(expected, 6);
    expect(MOBILE_FRAME.top - MOBILE_FRAME.bottom).toBeCloseTo(2.4, 6);
  });
});

describe('claimsHorizontalSwipe', () => {
  it('ignores movement shorter than the claim distance', () => {
    expect(claimsHorizontalSwipe(3, 0)).toBe(false);
  });
  it('claims a mostly-horizontal swipe', () => {
    expect(claimsHorizontalSwipe(20, 10)).toBe(true);
  });
  it('leaves steep vertical scrolls to the browser', () => {
    expect(claimsHorizontalSwipe(10, 40)).toBe(false);
  });
});

describe('drag & commit', () => {
  it('dragging left advances a forward flip and clamps to 0..1', () => {
    const w = 300;
    expect(dragProgress(0, -w * MOBILE_TUNING.onDrag.turnFraction, w)).toBeCloseTo(1, 6);
    expect(dragProgress(0, -10_000, w)).toBe(1);
    expect(dragProgress(0, 10_000, w)).toBe(0);
  });
  it('dragging right undoes a backward flip', () => {
    expect(dragProgress(1, 100, 300)).toBeLessThan(1);
  });
  it('commits only past the commit threshold in the flip direction', () => {
    expect(commitTarget(true, 0.05, 0)).toBe(0);
    expect(commitTarget(true, 0.2, 0)).toBe(1);
    expect(commitTarget(false, 0.95, 1)).toBe(1);
    expect(commitTarget(false, 0.7, 1)).toBe(0);
  });
});

describe('flipEase', () => {
  it('runs from 0 to 1 monotonically without launch', () => {
    expect(flipEase(0)).toBeCloseTo(0, 6);
    expect(flipEase(1)).toBeCloseTo(1, 6);
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = flipEase(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('with launch still lands on 0 and 1', () => {
    expect(flipEase(0, 1.5)).toBeCloseTo(0, 6);
    expect(flipEase(1, 1.5)).toBeCloseTo(1, 6);
  });
});

describe('holdTiming', () => {
  it('speeds up from first to fastest over speedUpSheets', () => {
    const first = holdTiming(0);
    const fast = holdTiming(MOBILE_TUNING.onHold.speedUpSheets);
    expect(first.flipTime).toBeCloseTo(MOBILE_TUNING.onHold.firstFlipTime, 6);
    expect(fast.flipTime).toBeCloseTo(MOBILE_TUNING.onHold.fastestFlipTime, 6);
    expect(fast.gap).toBeLessThan(first.gap);
    expect(holdTiming(999).flipTime).toBeCloseTo(MOBILE_TUNING.onHold.fastestFlipTime, 6);
  });
});

describe('smooth01 / hash', () => {
  it('smooth01 clamps and eases', () => {
    expect(smooth01(-1)).toBe(0);
    expect(smooth01(2)).toBe(1);
    expect(smooth01(0.5)).toBeCloseTo(0.5, 6);
  });
  it('hash is deterministic in [0,1)', () => {
    const h = hash(3, 41.5);
    expect(h).toBe(hash(3, 41.5));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });
});

describe('pile', () => {
  it('lift falls off with depth', () => {
    expect(pileLift(0)).toBeCloseTo(MOBILE_TUNING.onPile.liftHeight, 6);
    expect(pileLift(3)).toBeLessThan(pileLift(1));
  });
  it('reach is 1 with no lift and at least 0.5 otherwise', () => {
    expect(pileReach(0)).toBe(1);
    expect(pileReach(0.08)).toBeGreaterThanOrEqual(0.5);
    expect(pileReach(0.08)).toBeLessThanOrEqual(2);
  });
});

describe('catch-up & radius spacing', () => {
  it('catch-up is a monotonic remap of [0,x] onto [0,x]', () => {
    const x = 8;
    const Z = buildCatchUp(x);
    expect(Z).toHaveLength(x + 1);
    expect(catchUp(Z, x, 0)).toBeCloseTo(0, 6);
    expect(catchUp(Z, x, x)).toBe(x);
    expect(Z[x]).toBeCloseTo(x, 6);
    for (let i = 0; i < x; i++) expect(Z[i + 1]).toBeGreaterThan(Z[i]);
  });
  it('radius spacing starts at 0 and ends at 1', () => {
    const V = buildRadiusSpacing(8);
    expect(V[0]).toBe(0);
    expect(V[V.length - 1]).toBeCloseTo(1, 5);
  });
});

describe('computeSheetShape', () => {
  const x = 8;
  const base = {
    index: 0,
    flipProgress: 0,
    sumProgress: 0,
    count: x,
    grabX: 1,
    grabY: 0,
    wobbleTiltDeg: 0,
    catchUp: buildCatchUp(x),
    radii: buildRadiusSpacing(x),
  };

  it('a resting top sheet is flat: no rotation, no bend, no wrap', () => {
    const s = computeSheetShape(base);
    expect(s.flipRotation[0]).toBeCloseTo(1, 6);
    expect(s.flipRotation[1]).toBeCloseTo(0, 6);
    expect(s.tailBend).toBeCloseTo(0, 6);
    expect(s.cone[2]).toBeCloseTo(0, 6);
    expect(s.pileLift[0]).toBe(MOBILE_TUNING.onPile.liftPeakX);
    expect(s.pileLift[1]).toBeGreaterThan(0);
  });

  it('a fully flipped sheet (outside the rolled-open end state) lies to the left of the spine', () => {
    const s = computeSheetShape({ ...base, index: 0, flipProgress: 1, sumProgress: 1 });
    // spun about the spine by roughly the spine-open angle, never past a full turn
    const angle = Math.atan2(s.flipRotation[1], s.flipRotation[0]);
    expect(Math.abs(angle)).toBeGreaterThan(Math.PI / 2);
  });

  it('flip rotation grows with progress', () => {
    // 小进度下 lead 还没超过书脊张开角，旋转随进度增长；再往后会被钳在张开角上
    const a = computeSheetShape({ ...base, flipProgress: 0.05, sumProgress: 0.05 });
    const b = computeSheetShape({ ...base, flipProgress: 0.15, sumProgress: 0.15 });
    expect(Math.atan2(b.flipRotation[1], b.flipRotation[0])).toBeGreaterThan(
      Math.atan2(a.flipRotation[1], a.flipRotation[0])
    );
  });

  it('is finite for every progress', () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const s = computeSheetShape({ ...base, flipProgress: p, sumProgress: p, grabY: 0.7, wobbleTiltDeg: 5 });
      for (const v of [...s.pileLift, s.coneTaper, ...s.pileReach, ...s.cone, ...s.tailCurl, s.tailBend, ...s.flipRotation]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('end state: all sheets turned switches to the flat rotation branch', () => {
    const s = computeSheetShape({ ...base, index: 2, flipProgress: 1, sumProgress: x });
    expect(s.cone[0]).toBe(0);
    expect(s.cone[1]).toBe(1);
    expect(s.cone[2]).toBe(0);
    expect(s.tailBend).toBe(0);
  });
});

describe('book offset & visibility', () => {
  it('book is still at rest and only moves near the end', () => {
    const x = 8;
    const Z = buildCatchUp(x);
    expect(bookOffset(0, x, Z)).toEqual({ x: 0, z: 0 });
    const end = bookOffset(x, x, Z);
    expect(end.x).toBeCloseTo(0, 6); // (1 - K(end)) = 0 at the very end
  });
  it('only renders sheets within the pile depth, plus animating ones', () => {
    const depth = MOBILE_TUNING.onPile.renderDepth;
    expect(sheetVisible(depth, 0, 0, false, 10)).toBe(true);
    expect(sheetVisible(depth + 1, 0, 0, false, 10)).toBe(false);
    expect(sheetVisible(depth + 1, 0, 0, true, 10)).toBe(true);
  });
  it('render order puts the current sheet first', () => {
    expect(sheetRenderOrder(3, 3)).toBe(0);
    expect(sheetRenderOrder(2, 3)).toBe(0);
    expect(sheetRenderOrder(0, 3)).toBe(2);
    expect(sheetRenderOrder(5, 3)).toBe(2);
  });
});

describe('single-page query', () => {
  it('prefers one page below 1024px and in portrait', () => {
    expect(DEFAULT_SINGLE_PAGE_QUERY).toContain('max-width: 1023px');
    expect(DEFAULT_SINGLE_PAGE_QUERY).toContain('orientation: portrait');
  });
});

describe('mobileStageSize', () => {
  const pageHeightPx = (pH: number) => {
    const { height } = mobileStageSize(10_000, pH);
    return (1.377 * height * MOBILE_LAYER_SCALE) / 2.4;
  };

  it('keeps the frame aspect ratio', () => {
    const s = mobileStageSize(390, 686);
    expect(s.width / s.height).toBeCloseTo(mobileFrameAspect(), 6);
  });

  it('is height-limited in a tall window: content fills the height minus the margin', () => {
    const pH = 1560;
    const c = MOBILE_CONTENT_EXTENT;
    const u = (pH * (1 - MOBILE_FILL_MARGIN)) / (c.top + c.bottom);
    expect(pageHeightPx(pH)).toBeCloseTo(1.377 * u, 4);
    // 比原来按整幅画框撑满（页高约占 57%×1.3 = 75%）明显更满
    expect(pageHeightPx(pH) / pH).toBeGreaterThan(0.82);
  });

  it('is width-limited in a narrow window: content spans the width minus the margin', () => {
    const s = mobileStageSize(390, 5000);
    const u = (s.height * MOBILE_LAYER_SCALE) / 2.4;
    expect(2 * MOBILE_CONTENT_EXTENT.halfWidth * u).toBeCloseTo(390 * (1 - MOBILE_FILL_MARGIN), 4);
  });

  it('shifts the container down so the fan-heavy extent is centred', () => {
    expect(mobileStageSize(800, 800).offsetY).toBeGreaterThan(0);
  });

  it('reserves room at the bottom: smaller content, moved up by half the reserve', () => {
    const a = mobileStageSize(5000, 1000);
    const b = mobileStageSize(5000, 1000, 40);
    expect(b.height).toBeLessThan(a.height);
    // 内容底边 = 容器中心 + offsetY 之下的部分，必须落在预留区之上
    const u = (b.height * MOBILE_LAYER_SCALE) / 2.4;
    const contentBottom = 1000 / 2 + b.offsetY + MOBILE_CONTENT_EXTENT.bottom * u;
    expect(contentBottom).toBeLessThanOrEqual(1000 - 40 + 1e-6);
  });
});
