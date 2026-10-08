import { describe, it, expect } from 'vitest';
import { buildSelectionShape, tracePolygon, toLineBoxes, rgba, traceSegments } from './selectionShape';

const opts = { cornerRadius: 10, filletRadius: 12, padX: 0 };
const R = (x: number, y: number, w: number, h = 40) => ({ x, y, width: w, height: h });

describe('selection fusion shape', () => {
  it('single line is a rounded pill: 4 convex corners', () => {
    const segs = buildSelectionShape([R(100, 100, 200)], opts);
    expect(segs).toHaveLength(4);
    expect(segs.every((s) => !s.concave)).toBe(true);
    expect(segs.every((s) => s.r === 10)).toBe(true);
  });

  it('caps radius to half of the shortest adjacent edge', () => {
    const segs = buildSelectionShape([R(0, 0, 8, 40)], opts);
    expect(Math.max(...segs.map((s) => s.r))).toBeLessThanOrEqual(8 / 2.05 + 1e-9);
  });

  it('stair-stepped lines produce concave fillets at the junctions', () => {
    // 第 1 行较短、第 2 行右侧更长 → 右侧一个内倒角；左侧对齐无额外拐点
    const segs = buildSelectionShape([R(100, 100, 150), R(100, 150, 300)], opts);
    const concave = segs.filter((s) => s.concave);
    expect(concave).toHaveLength(1);
    expect(concave[0].r).toBe(12);
  });

  it('flush lines collapse into one rectangle (no collinear vertices)', () => {
    const verts = tracePolygon(toLineBoxes([R(100, 100, 200), R(100, 150, 200)], 0));
    expect(verts).toHaveLength(4);
  });

  it('left/right ragged lines yield both inner and outer corners', () => {
    const segs = buildSelectionShape([R(200, 100, 200), R(100, 150, 150), R(100, 200, 300)], opts);
    expect(segs.filter((s) => s.concave).length).toBeGreaterThanOrEqual(2);
    expect(segs.filter((s) => !s.concave).length).toBeGreaterThanOrEqual(4);
  });

  it('emits a closed path starting and ending on tangent points', () => {
    const calls: string[] = [];
    const sink = {
      moveTo: () => calls.push('M'),
      lineTo: () => calls.push('L'),
      quadraticCurveTo: () => calls.push('Q'),
      closePath: () => calls.push('Z'),
    };
    traceSegments(sink, buildSelectionShape([R(0, 0, 100)], opts));
    expect(calls[0]).toBe('M');
    expect(calls[calls.length - 1]).toBe('Z');
    expect(calls.filter((c) => c === 'Q')).toHaveLength(4);
  });

  it('rgba parses hex and passes other colours through', () => {
    expect(rgba('#9B2D26', 0.5)).toBe('rgba(155, 45, 38, 0.5)');
    expect(rgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(rgba('red', 0.5)).toBe('red');
  });
});
