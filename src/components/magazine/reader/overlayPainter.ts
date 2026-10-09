import { PageContent } from '../chinesePublicationData';
import { CANVAS_WIDTH, getCachedLayoutElements } from '../pageLayout';
import { paintSelection } from '../pageRenderer';
import { selectionRects, type Rect } from '../textMetrics';
import { rgba } from '../selectionShape';
import type { AnnotationType } from './annotations';

/** 绘进页面纹理的阅读层（随纸张一起弯曲）。纯数据，便于比较去重。 */
export interface ReaderPageOverlay {
  annotations?: { type: AnnotationType; color: string; elementId: string; from: number; to: number; hasNote: boolean }[];
  search?: { elementId: string; from: number; to: number; current: boolean }[];
  selection?: { elementId: string; from: number; to: number }[];
  bookmarked?: boolean;
}

const roundRect = (ctx: CanvasRenderingContext2D, r: Rect, radius: number) => {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.width, r.height, radius);
};

function drawWave(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  const step = 5;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  for (let x = x0, i = 0; x < x1; x += step, i++) {
    ctx.lineTo(Math.min(x + step, x1), y + (i % 2 === 0 ? -3 : 3));
  }
  ctx.stroke();
}

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  type: AnnotationType,
  color: string,
  rects: Rect[]
) {
  ctx.save();
  for (const r of rects) {
    if (type === 'highlight') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = rgba(color, 0.55);
      roundRect(ctx, { x: r.x - 3, y: r.y - 2, width: r.width + 6, height: r.height + 4 }, r.height * 0.28);
      ctx.fill();
      continue;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (type === 'underline') {
      const y = r.y + r.height + 4;
      ctx.beginPath();
      ctx.moveTo(r.x, y);
      ctx.lineTo(r.x + r.width, y);
      ctx.stroke();
    } else if (type === 'wave') {
      drawWave(ctx, r.x, r.x + r.width, r.y + r.height + 5);
    } else {
      const y = r.y + r.height * 0.52;
      ctx.beginPath();
      ctx.moveTo(r.x - 1, y);
      ctx.lineTo(r.x + r.width + 1, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawNoteMarker(ctx: CanvasRenderingContext2D, rects: Rect[], accent: string) {
  const last = rects[rects.length - 1];
  if (!last) return;
  const cx = last.x + last.width + 14;
  const cy = last.y - 2;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(cx - 10, cy - 9, 20, 16, 5);
  ctx.moveTo(cx - 3, cy + 6);
  ctx.lineTo(cx - 6, cy + 12);
  ctx.lineTo(cx + 2, cy + 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (const dx of [-5, 0, 5]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBookmark(ctx: CanvasRenderingContext2D, isLeft: boolean, accent: string) {
  const w = 34;
  const h = 104;
  const x = isLeft ? 70 : CANVAS_WIDTH - 70 - w;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + w, 0);
  ctx.lineTo(x + w, h);
  ctx.lineTo(x + w / 2, h - 16);
  ctx.lineTo(x, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function paintReaderOverlay(
  ctx: CanvasRenderingContext2D,
  page: PageContent,
  pageIndex: number,
  overlay: ReaderPageOverlay,
  accent: string
) {
  const elements = new Map(getCachedLayoutElements(page, pageIndex).map((e) => [e.id, e]));
  const rectsOf = (id: string, from: number, to: number) => {
    const el = elements.get(id);
    return el ? { el, rects: selectionRects(el.style, el.text, from, to) } : null;
  };

  for (const a of overlay.annotations ?? []) {
    const g = rectsOf(a.elementId, a.from, a.to);
    if (!g) continue;
    drawAnnotation(ctx, a.type, a.color, g.rects);
    if (a.hasNote) drawNoteMarker(ctx, g.rects, rgba('#8a5a1f', 1));
  }

  for (const m of overlay.search ?? []) {
    const g = rectsOf(m.elementId, m.from, m.to);
    if (!g) continue;
    ctx.save();
    for (const r of g.rects) {
      ctx.fillStyle = m.current ? 'rgba(255,152,0,0.55)' : 'rgba(255,193,7,0.38)';
      roundRect(ctx, { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 }, 6);
      ctx.fill();
      if (m.current) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  for (const s of overlay.selection ?? []) {
    const g = rectsOf(s.elementId, s.from, s.to);
    if (g) paintSelection(ctx, g.el.style, g.rects, accent);
  }

  if (overlay.bookmarked) drawBookmark(ctx, page.sideIndex % 2 === 0, accent);
}
