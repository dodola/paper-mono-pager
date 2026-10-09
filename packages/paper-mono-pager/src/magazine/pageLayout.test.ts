import { describe, it, expect } from 'vitest';
import { CHINESE_PAGES, PageContent } from './chinesePublicationData';
import { getPageLayoutElements, findLayoutElementAtCoords } from './pageLayout';
import { caretGeometry, indexAtPoint, textLines, moveCaretVertically } from './textMetrics';

const LONG = '天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。寒来暑往，秋收冬藏。'.repeat(6);

const mk = (type: PageContent['type'], paragraphs: string[]): PageContent => ({
  type,
  sideIndex: 5,
  title: '题',
  paragraphs,
});

// 渲染器的段落步长：每行 lineHeight，段后间距 gap
const STEP: Record<string, { gap: number }> = {
  spread: { gap: 26 },
  frontispiece: { gap: 28 },
  chapter: { gap: 0 },
};

describe('paragraph layout stays in sync with renderer steps', () => {
  for (const type of Object.keys(STEP) as ('spread' | 'frontispiece' | 'chapter')[]) {
    it(`${type}: stacked paragraphs advance by lines*lineHeight+gap`, () => {
      const els = getPageLayoutElements(mk(type, [LONG, '短段', LONG, '尾']), 4).filter(
        (e) => e.type === 'paragraph'
      );
      expect(els).toHaveLength(4);
      for (let i = 0; i < els.length - 1; i++) {
        const s = els[i].style;
        const lines = textLines(s, els[i].text).lines.length;
        const dy = els[i + 1].style.baselineY - s.baselineY;
        expect(dy).toBe(lines * s.lineHeight + STEP[type].gap);
      }
    });

    it(`${type}: hit boxes of neighbouring paragraphs do not overlap`, () => {
      const els = getPageLayoutElements(mk(type, [LONG, LONG, LONG]), 4).filter(
        (e) => e.type === 'paragraph'
      );
      for (let i = 0; i < els.length - 1; i++) {
        expect(els[i].bounds.y + els[i].bounds.height).toBeLessThanOrEqual(els[i + 1].bounds.y);
      }
    });
  }
});

describe('layout element presence', () => {
  it('keeps an empty subtitle selectable so it can be typed back', () => {
    const page: PageContent = { type: 'chapter', sideIndex: 3, title: 'T', subtitle: '' };
    expect(getPageLayoutElements(page, 2).some((e) => e.id === 'subtitle')).toBe(true);
  });

  it('colophon title falls back to the CIP heading the renderer draws', () => {
    const page: PageContent = { type: 'colophon', sideIndex: 16, title: '' };
    const t = getPageLayoutElements(page, 15).find((e) => e.id === 'title');
    expect(t?.text).toContain('图书在版编目');
  });

  it('hit testing returns the paragraph under the point', () => {
    const els = getPageLayoutElements(mk('spread', [LONG, LONG]), 4);
    const second = els.find((e) => e.id === 'paragraph-1')!;
    const b = second.bounds;
    expect(findLayoutElementAtCoords(els, b.x + 20, b.y + b.height / 2)?.id).toBe('paragraph-1');
  });
});

describe('caret geometry', () => {
  it('index -> caret -> index round-trips on every real page element', () => {
    CHINESE_PAGES.forEach((page, pi) => {
      for (const el of getPageLayoutElements(page, pi)) {
        if (el.type === 'seal' || el.style.vertical) continue;
        const samples = new Set([0, 1, Math.floor(el.text.length / 2), el.text.length]);
        for (const idx of samples) {
          if (idx > el.text.length) continue;
          const g = caretGeometry(el.style, el.text, idx);
          const back = indexAtPoint(el.style, el.text, g.x + 0.5, g.top + g.height / 2);
          expect(back, `${el.id} on page ${pi + 1} idx ${idx}`).toBe(idx);
        }
      }
    });
  });

  it('centered text puts the end caret right of the block centre', () => {
    const page: PageContent = { type: 'poetry', sideIndex: 3, title: '诗', poetryLines: ['床前明月光'] };
    const el = getPageLayoutElements(page, 2).find((e) => e.id === 'poetry-0')!;
    expect(caretGeometry(el.style, el.text, 5).x).toBeGreaterThan(el.style.anchorX);
    expect(caretGeometry(el.style, el.text, 0).x).toBeLessThan(el.style.anchorX);
  });

  it('moves vertically between wrapped lines and reports the edges', () => {
    const el = getPageLayoutElements(mk('spread', [LONG]), 4).find((e) => e.id === 'paragraph-0')!;
    const down = moveCaretVertically(el.style, el.text, 3, 1)!;
    expect(down).toBeGreaterThan(10);
    expect(moveCaretVertically(el.style, el.text, 3, -1)).toBeNull();
  });
});
