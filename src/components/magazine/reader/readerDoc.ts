import { PageContent } from '../chinesePublicationData';
import { PageLayoutElement, getCachedLayoutElements } from '../pageLayout';
import { indexAtPoint } from '../textMetrics';

/** 阅读器视角下的一段可选文字（版式元素的只读投影） */
export interface Run {
  pageIndex: number;
  elementId: string;
  /** 全局阅读顺序 */
  order: number;
  text: string;
  el: PageLayoutElement;
}

export interface Pos {
  pageIndex: number;
  elementId: string;
  offset: number;
}

export interface Segment {
  run: Run;
  from: number;
  to: number;
}

export const runKey = (pageIndex: number, elementId: string) => `${pageIndex}:${elementId}`;

/** 按阅读顺序拍平若干页的可选文字；印章等非正文不参与选择 */
export function buildRuns(pages: PageContent[], pageIndices: number[]): Run[] {
  const runs: Run[] = [];
  for (const pageIndex of pageIndices) {
    const page = pages[pageIndex];
    if (!page) continue;
    for (const el of getCachedLayoutElements(page, pageIndex)) {
      if (el.type === 'seal' || el.text === '') continue;
      runs.push({ pageIndex, elementId: el.id, order: runs.length, text: el.text, el });
    }
  }
  return runs;
}

export const findRun = (runs: Run[], pageIndex: number, elementId: string) =>
  runs.find((r) => r.pageIndex === pageIndex && r.elementId === elementId) ?? null;

export function comparePos(runs: Run[], a: Pos, b: Pos): number {
  if (a.pageIndex === b.pageIndex && a.elementId === b.elementId) return a.offset - b.offset;
  const ra = findRun(runs, a.pageIndex, a.elementId);
  const rb = findRun(runs, b.pageIndex, b.elementId);
  return (ra?.order ?? -1) - (rb?.order ?? -1);
}

/** 两端点（不分先后）覆盖的逐元素区间 */
export function segmentsOf(runs: Run[], a: Pos, b: Pos): Segment[] {
  const [lo, hi] = comparePos(runs, a, b) <= 0 ? [a, b] : [b, a];
  const rl = findRun(runs, lo.pageIndex, lo.elementId);
  const rh = findRun(runs, hi.pageIndex, hi.elementId);
  if (!rl || !rh) return [];
  const out: Segment[] = [];
  for (let i = rl.order; i <= rh.order; i++) {
    const run = runs[i];
    const from = run === rl ? lo.offset : 0;
    const to = run === rh ? hi.offset : run.text.length;
    if (to > from) out.push({ run, from, to });
  }
  return out;
}

export function textOf(runs: Run[], a: Pos, b: Pos): string {
  return segmentsOf(runs, a, b)
    .map((s) => s.run.text.slice(s.from, s.to))
    .join('\n');
}

const inside = (r: Run, x: number, y: number, tol: number) => {
  const b = r.el.bounds;
  return x >= b.x - tol && x <= b.x + b.width + tol && y >= b.y - tol && y <= b.y + b.height + tol;
};

/**
 * 画布坐标 → 位置。
 * clamp=false：只命中元素包围盒内的点（用于按下时判断是否落在文字上）；
 * clamp=true：拖拽中吸附到垂直距离最近的元素，穿过行间空隙或页边也不丢选区。
 */
export function posAtPoint(runs: Run[], pageIndex: number, x: number, y: number, clamp: boolean): Pos | null {
  const onPage = runs.filter((r) => r.pageIndex === pageIndex);
  let target: Run | null = null;
  for (let i = onPage.length - 1; i >= 0; i--) {
    if (inside(onPage[i], x, y, 0)) {
      target = onPage[i];
      break;
    }
  }
  if (!target && clamp) {
    let best = Infinity;
    for (const r of onPage) {
      const b = r.el.bounds;
      const d = y < b.y ? b.y - y : y > b.y + b.height ? y - (b.y + b.height) : 0;
      if (d < best) {
        best = d;
        target = r;
      }
    }
  }
  if (!target) return null;
  const b = target.el.bounds;
  // 在元素上方/下方吸附时，落到首/末字符
  let offset: number;
  if (y < b.y) offset = 0;
  else if (y > b.y + b.height) offset = target.text.length;
  else offset = indexAtPoint(target.el.style, target.text, x, y);
  return { pageIndex, elementId: target.elementId, offset };
}

let segmenter: Intl.Segmenter | null | undefined;
function getSegmenter() {
  if (segmenter === undefined) {
    try {
      segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
    } catch {
      segmenter = null;
    }
  }
  return segmenter;
}

/** 偏移处的词范围；无分词器或落在边界时退化为单字 */
export function wordRange(text: string, offset: number): { from: number; to: number } {
  if (text === '') return { from: 0, to: 0 };
  const o = Math.max(0, Math.min(offset, text.length - 1));
  const seg = getSegmenter();
  if (seg) {
    for (const s of seg.segment(text)) {
      if (o >= s.index && o < s.index + s.segment.length) {
        return { from: s.index, to: s.index + s.segment.length };
      }
    }
  }
  return { from: o, to: o + 1 };
}

export const paragraphRange = (text: string) => ({ from: 0, to: text.length });
