import type { Rect } from './textMetrics';

/**
 * 圆角 + 倒角融合选区（移植自 ai_text_selection）：
 * 逐行矩形 → 正交多边形 → 凸角用外圆角、凹角（上下行宽度不一的交界）用内倒角 → 单条无缝路径。
 */

export interface Pt {
  x: number;
  y: number;
}

export interface LineBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Segment {
  pStart: Pt;
  corner: Pt;
  pEnd: Pt;
  concave: boolean;
  r: number;
}

export interface ShapeOptions {
  cornerRadius: number;
  filletRadius: number;
  padX: number;
}

/** 逐行选区矩形 → 行盒（水平外扩 padX） */
export function toLineBoxes(rects: Rect[], padX: number): LineBox[] {
  return rects
    .filter((r) => r.width > 0.2 && r.height > 0.2)
    .map((r) => ({
      left: r.x - padX,
      right: r.x + r.width + padX,
      top: r.y,
      bottom: r.y + r.height,
    }));
}

const EPS = 2;

/** 顺时针追踪多行外轮廓；行间交界取行距中线，使上下行咬合 */
export function tracePolygon(lines: LineBox[]): Pt[] {
  const n = lines.length;
  if (n === 0) return [];
  const pts: Pt[] = [];
  const first = lines[0];
  const last = lines[n - 1];

  pts.push({ x: first.left, y: first.top }, { x: first.right, y: first.top });
  for (let i = 0; i < n; i++) {
    const cur = lines[i];
    if (i < n - 1) {
      const next = lines[i + 1];
      const stepY = (cur.bottom + next.top) / 2;
      pts.push({ x: cur.right, y: stepY });
      if (Math.abs(cur.right - next.right) > EPS) pts.push({ x: next.right, y: stepY });
    } else {
      pts.push({ x: cur.right, y: cur.bottom });
    }
  }
  pts.push({ x: last.left, y: last.bottom });
  for (let i = n - 1; i > 0; i--) {
    const cur = lines[i];
    const prev = lines[i - 1];
    const stepY = (cur.top + prev.bottom) / 2;
    pts.push({ x: cur.left, y: stepY });
    if (Math.abs(cur.left - prev.left) > EPS) pts.push({ x: prev.left, y: stepY });
  }

  // 去掉重复点与共线点，避免无意义的圆角
  const dedup = pts.filter((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.hypot(p.x - q.x, p.y - q.y) > 1.5;
  });
  return dedup.filter((p, i) => {
    const a = dedup[(i - 1 + dedup.length) % dedup.length];
    const b = dedup[(i + 1) % dedup.length];
    return Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > 0.01;
  });
}

/** 为每个拐点计算圆弧切点；叉积 < 0 为凹角（内倒角） */
export function roundCorners(vertices: Pt[], opts: ShapeOptions): Segment[] {
  const M = vertices.length;
  if (M < 3) return [];
  const segs: Segment[] = [];
  for (let i = 0; i < M; i++) {
    const prev = vertices[(i - 1 + M) % M];
    const curr = vertices[i];
    const next = vertices[(i + 1) % M];
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 0.1 || len2 < 0.1) continue;
    const concave = v1x * v2y - v1y * v2x < -0.01;
    const r = Math.min(concave ? opts.filletRadius : opts.cornerRadius, len1 / 2.05, len2 / 2.05);
    segs.push({
      pStart: { x: curr.x - (v1x / len1) * r, y: curr.y - (v1y / len1) * r },
      corner: curr,
      pEnd: { x: curr.x + (v2x / len2) * r, y: curr.y + (v2y / len2) * r },
      concave,
      r,
    });
  }
  return segs;
}

export function buildSelectionShape(rects: Rect[], opts: ShapeOptions): Segment[] {
  return roundCorners(tracePolygon(toLineBoxes(rects, opts.padX)), opts);
}

type PathSink = Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'closePath'>;

export function traceSegments(path: PathSink, segs: Segment[]) {
  if (segs.length === 0) return;
  path.moveTo(segs[0].pStart.x, segs[0].pStart.y);
  segs.forEach((s, i) => {
    path.quadraticCurveTo(s.corner.x, s.corner.y, s.pEnd.x, s.pEnd.y);
    const next = segs[(i + 1) % segs.length];
    path.lineTo(next.pStart.x, next.pStart.y);
  });
  path.closePath();
}

export function rgba(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
