import { describe, expect, it } from 'vitest';
import fixtures from './__fixtures__/reference-uniforms.json';
import { MOBILE_TUNING, buildCatchUp, buildRadiusSpacing, computeSheetShape } from './mobileModel';

type Draw = { L: number[]; T: number[]; R: number[]; C: number[]; B: number[]; K: number[]; F: number[] };

const x = fixtures.count;
const catchUp = buildCatchUp(x);
const radii = buildRadiusSpacing(x);

/** 与参考实现逐项比较着色器参数；落下分支里 uTailCurl 不更新（弯曲量为 0，值不影响画面），不比较 */
function maxDiff(index: number, flipProgress: number, sum: number, o: Draw): number {
  const s = computeSheetShape({ index, flipProgress, sumProgress: sum, count: x, grabX: 1, grabY: 0, wobbleTiltDeg: 0, catchUp, radii });
  const flat = o.K[1] === 1 && o.K[2] === 0 && o.B[0] === 0;
  return Math.max(
    ...s.cone.map((v, j) => Math.abs(v - o.K[j])),
    ...(flat ? [0] : s.tailCurl.map((v, j) => Math.abs(v - o.C[j]))),
    Math.abs(s.pileLift[1] - o.L[1]),
    Math.abs(s.coneTaper - o.T[0]),
    ...s.pileReach.map((v, j) => Math.abs(v - o.R[j])),
    Math.abs(s.tailBend - o.B[0]),
    Math.abs(s.flipRotation[0] - o.F[0]),
    Math.abs(s.flipRotation[1] - o.F[1])
  );
}

describe('parity with the reference magazine', () => {
  it('matches the initial state (14 of 26 sheets turned) for every drawn sheet', () => {
    const turned = 14;
    const drawn = Array.from({ length: x }, (_, i) => i).filter((i) => i < turned || i <= turned + MOBILE_TUNING.onPile.renderDepth);
    const order = (i: number) => (i < turned ? turned - 1 - i : i - turned);
    drawn.sort((a, b) => order(a) - order(b) || a - b);
    expect(drawn).toHaveLength(fixtures.t14.length);
    drawn.forEach((idx, k) => {
      expect(maxDiff(idx, idx < turned ? 1 : 0, turned, fixtures.t14[k] as Draw)).toBeLessThan(1e-3);
    });
  });

  it('matches every sheet through the whole last-page finale', () => {
    fixtures.finale.forEach((frame) => {
      const draws = frame as Draw[];
      // 绘制顺序：翻起前 T=25 为 [24, 25, 23, …]，翻起后 T=26 为 [25, 24, …]
      const beforeTurn = draws[0].F[0] < -0.98 && draws[0].K[2] > 2.9;
      const indexOf = (k: number) => (beforeTurn ? (k === 0 ? 24 : k === 1 ? 25 : 25 - k) : 25 - k);
      // 最后一张（idx 25）带随机抖动和抓取倾斜，不参与比较；其余 25 张都已翻过，总进度 = 25 + b
      let best = Infinity;
      for (let b = 0; b <= 1.0001; b += 0.0005) {
        let worst = 0;
        draws.forEach((d, k) => {
          const idx = indexOf(k);
          if (idx !== 25) worst = Math.max(worst, maxDiff(idx, 1, 25 + b, d));
        });
        best = Math.min(best, worst);
      }
      expect(best).toBeLessThan(1e-3);
    });
  });
});
