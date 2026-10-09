import { describe, it, expect } from 'vitest';
import { desktopPageRange, planTextures } from './textureWindow';

describe('desktopPageRange', () => {
  // 140 页 = 70 张纸；对开页序号 0 = 封面，70 = 封底
  const N = 140;
  const S = 70;

  it('cover: shows sheet 0 and looks ahead', () => {
    // radius 1：可见的右页来自第 0 张，再向后 1 张 → 页 0..3
    expect(desktopPageRange(0, S, N, 1)).toEqual([0, 3]);
  });

  it('middle spread keeps the visible pair plus radius sheets each side', () => {
    // cs=10：左页在第 9 张背面，右页在第 10 张正面；radius 2 → 第 7..12 张 → 页 14..25
    expect(desktopPageRange(10, S, N, 2)).toEqual([14, 25]);
  });

  it('always contains both visible pages', () => {
    for (const cs of [0, 1, 5, 69, 70]) {
      const [lo, hi] = desktopPageRange(cs, S, N, 1);
      if (cs > 0) expect(lo).toBeLessThanOrEqual(cs * 2 - 1);
      if (cs < S) expect(hi).toBeGreaterThanOrEqual(cs * 2);
    }
  });

  it('back cover clamps to the last page', () => {
    expect(desktopPageRange(70, S, N, 2)).toEqual([134, 139]);
  });

  it('odd page counts clamp the final half sheet', () => {
    // 5 页 = 3 张纸，最后一张只有正面
    expect(desktopPageRange(3, 3, 5, 3)).toEqual([0, 4]);
  });

  it('window size is independent of book length', () => {
    const size = (n: number) => {
      const [lo, hi] = desktopPageRange(n / 4, n / 2, n, 2);
      return hi - lo + 1;
    };
    expect(size(140)).toBe(size(1400));
  });
});

describe('planTextures', () => {
  it('builds only the missing pages inside the keep range', () => {
    expect(planTextures([4, 5], [4, 7], 0)).toEqual({ build: [6, 7], release: [] });
  });

  it('releases pages beyond the margin but keeps the hysteresis band', () => {
    // 保留 [10,13]，余量 2 页：8..15 内的不释放
    const plan = planTextures([2, 8, 9, 10, 13, 15, 16, 30], [10, 13], 2);
    expect(plan.release).toEqual([2, 16, 30]);
    expect(plan.build).toEqual([11, 12]);
  });

  it('does nothing when already settled', () => {
    expect(planTextures([4, 5, 6, 7], [4, 7], 2)).toEqual({ build: [], release: [] });
  });
});
