import { describe, it, expect } from 'vitest';
import { PageContent } from '../chinesePublicationData';
import {
  buildRuns,
  comparePos,
  segmentsOf,
  textOf,
  posAtPoint,
  wordRange,
  paragraphRange,
  Pos,
} from './readerDoc';
import { getCachedLayoutElements } from '../pageLayout';

const page = (sideIndex: number, paragraphs: string[]): PageContent => ({
  type: 'spread',
  sideIndex,
  title: '篇名',
  paragraphs,
});
const pages = [page(1, ['甲乙丙丁。']), page(2, ['第一段文字。', '第二段文字。']), page(3, ['右页内容。'])];

describe('buildRuns', () => {
  it('orders runs by page then layout order and skips seals', () => {
    const runs = buildRuns(pages, [1, 2]);
    expect(runs.map((r) => `${r.pageIndex}:${r.elementId}`)).toEqual([
      '1:title',
      '1:paragraph-0',
      '1:paragraph-1',
      '2:title',
      '2:paragraph-0',
    ]);
    expect(runs.every((r) => r.elementId !== 'seal')).toBe(true);
  });
});

describe('selection ordering and text', () => {
  const runs = buildRuns(pages, [1, 2]);
  const p = (pageIndex: number, elementId: string, offset: number): Pos => ({ pageIndex, elementId, offset });

  it('comparePos orders across elements and pages', () => {
    expect(comparePos(runs, p(1, 'paragraph-0', 3), p(1, 'paragraph-1', 0))).toBeLessThan(0);
    expect(comparePos(runs, p(2, 'title', 0), p(1, 'paragraph-1', 5))).toBeGreaterThan(0);
    expect(comparePos(runs, p(1, 'title', 2), p(1, 'title', 2))).toBe(0);
  });

  it('segmentsOf is direction independent and spans elements', () => {
    const a = p(1, 'paragraph-0', 2);
    const b = p(1, 'paragraph-1', 3);
    const fwd = segmentsOf(runs, a, b);
    expect(fwd).toEqual(segmentsOf(runs, b, a));
    expect(fwd.map((s) => [s.run.elementId, s.from, s.to])).toEqual([
      ['paragraph-0', 2, 6],
      ['paragraph-1', 0, 3],
    ]);
  });

  it('textOf joins elements with newlines', () => {
    expect(textOf(runs, p(1, 'paragraph-0', 2), p(1, 'paragraph-1', 3))).toBe('段文字。\n第二段');
    expect(textOf(runs, p(1, 'title', 0), p(1, 'title', 0))).toBe('');
  });
});

describe('posAtPoint', () => {
  it('maps a point inside a paragraph to a character offset', () => {
    const runs = buildRuns(pages, [1]);
    const el = getCachedLayoutElements(pages[1], 1).find((e) => e.id === 'paragraph-0')!;
    const x = el.bounds.x + 5;
    const y = el.bounds.y + el.bounds.height / 2;
    const hit = posAtPoint(runs, 1, x, y, false);
    expect(hit?.elementId).toBe('paragraph-0');
  });

  it('returns null in empty space when not clamping, nearest line when clamping', () => {
    const runs = buildRuns(pages, [1]);
    expect(posAtPoint(runs, 1, 5, 5, false)).toBeNull();
    expect(posAtPoint(runs, 1, 5, 5, true)?.elementId).toBe('title');
  });
});

describe('word / paragraph ranges', () => {
  it('selects a Chinese word around the offset', () => {
    const r = wordRange('我们喜欢阅读书籍', 4);
    expect(r.to).toBeGreaterThan(r.from);
    expect(r.from).toBeLessThanOrEqual(4);
    expect(r.to).toBeGreaterThan(4);
  });
  it('falls back to one character without a segmenter hit', () => {
    expect(wordRange('', 0)).toEqual({ from: 0, to: 0 });
  });
  it('paragraphRange covers the whole text', () => {
    expect(paragraphRange('一二三')).toEqual({ from: 0, to: 3 });
  });
});
