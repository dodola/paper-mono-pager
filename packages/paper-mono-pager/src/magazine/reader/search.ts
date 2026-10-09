import { Run } from './readerDoc';

export interface Match {
  pageIndex: number;
  elementId: string;
  from: number;
  to: number;
}

/** 全书逐元素查找（忽略大小写，不跨元素）；limit 防止超短关键词刷屏 */
export function findMatches(runs: Run[], query: string, limit = 500): Match[] {
  if (query === '') return [];
  const q = query.toLowerCase();
  const out: Match[] = [];
  for (const r of runs) {
    const t = r.text.toLowerCase();
    let i = t.indexOf(q);
    while (i >= 0 && out.length < limit) {
      out.push({ pageIndex: r.pageIndex, elementId: r.elementId, from: i, to: i + q.length });
      i = t.indexOf(q, i + q.length);
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** 从某页起的第一个命中下标（环绕） */
export function firstMatchFrom(matches: Match[], pageIndex: number): number {
  const i = matches.findIndex((m) => m.pageIndex >= pageIndex);
  return matches.length === 0 ? -1 : i < 0 ? 0 : i;
}

export const sheetOfPage = (pageIndex: number) => (pageIndex === 0 ? 0 : Math.floor((pageIndex + 1) / 2));
