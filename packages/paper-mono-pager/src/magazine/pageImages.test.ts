import { describe, it, expect } from 'vitest';
import { fitRect } from './pageImages';
import { figuresAt, figureAdvance, figureRect, pageImageUrls } from './figureFlow';
import { PageContent } from './chinesePublicationData';
import { getPageLayoutElements } from './pageLayout';
import { validateImportedPages } from './pageEdit';

describe('fitRect', () => {
  it('cover fills the box and crops the overflow evenly', () => {
    // 宽图塞进竖版页：按高度铺满，左右各裁掉一半多余
    expect(fitRect(2000, 1000, 1000, 1000, 'cover')).toEqual({ x: -500, y: 0, width: 2000, height: 1000 });
  });

  it('contain letterboxes inside the box', () => {
    expect(fitRect(2000, 1000, 1000, 1000, 'contain')).toEqual({ x: 0, y: 250, width: 1000, height: 500 });
  });

  it('an image with the page aspect fills it exactly in both modes', () => {
    const box = { x: 0, y: 0, width: 1440, height: 1983 };
    expect(fitRect(720, 991.5, 1440, 1983, 'cover')).toEqual(box);
    expect(fitRect(720, 991.5, 1440, 1983, 'contain')).toEqual(box);
  });

  it('degenerate image sizes fall back to the whole box', () => {
    expect(fitRect(0, 0, 100, 200, 'cover')).toEqual({ x: 0, y: 0, width: 100, height: 200 });
  });
});

describe('image pages', () => {
  const img: PageContent = { type: 'spread', sideIndex: 3, title: 'T', paragraphs: ['甲'], imageUrl: '/a.png' };

  it('expose no editable/selectable text elements', () => {
    expect(getPageLayoutElements(img, 2)).toEqual([]);
    expect(getPageLayoutElements({ ...img, imageUrl: undefined }, 2).length).toBeGreaterThan(0);
  });

  it('import validation accepts imageUrl/imageFit and rejects bad values', () => {
    const ok = validateImportedPages([{ ...img, imageFit: 'contain' }], 1);
    expect(ok.ok).toBe(true);
    expect(validateImportedPages([{ ...img, imageUrl: 3 }], 1).ok).toBe(false);
    expect(validateImportedPages([{ ...img, imageFit: 'stretch' }], 1).ok).toBe(false);
  });
});

describe('inline figures (图文混排)', () => {
  const base: PageContent = {
    type: 'spread',
    sideIndex: 5,
    title: 'T',
    paragraphs: ['甲'.repeat(30), '乙'.repeat(30), '丙'.repeat(30)],
  };
  const fig = { url: '/f.png', height: 400 };
  const baseline = (p: PageContent, id: string) =>
    getPageLayoutElements(p, 4).find((e) => e.id === id)!.style.baselineY;

  it('slot clamps: default/oversized -> end, negative -> start', () => {
    const n = 3;
    expect(figuresAt({ ...base, figures: [fig] }, n)).toHaveLength(1);
    expect(figuresAt({ ...base, figures: [{ ...fig, beforeParagraph: 99 }] }, n)).toHaveLength(1);
    expect(figuresAt({ ...base, figures: [{ ...fig, beforeParagraph: -2 }] }, 0)).toHaveLength(1);
    expect(figuresAt({ ...base, figures: [{ ...fig, beforeParagraph: 1 }] }, 1)).toHaveLength(1);
    expect(figuresAt({ ...base, figures: [{ ...fig, beforeParagraph: 1 }] }, 0)).toHaveLength(0);
  });

  it('advance includes caption row only when a caption exists', () => {
    expect(figureAdvance({ ...fig, caption: '图一' })).toBe(figureAdvance(fig) + 44);
  });

  it('pushes only the paragraphs after the figure down, by exactly its advance', () => {
    const withFig: PageContent = { ...base, figures: [{ ...fig, beforeParagraph: 1, caption: '图' }] };
    const adv = figureAdvance(withFig.figures![0]);
    expect(baseline(withFig, 'paragraph-0')).toBe(baseline(base, 'paragraph-0'));
    expect(baseline(withFig, 'paragraph-1')).toBe(baseline(base, 'paragraph-1') + adv);
    expect(baseline(withFig, 'paragraph-2')).toBe(baseline(base, 'paragraph-2') + adv);
  });

  it('a figure placed last does not move any paragraph', () => {
    const withFig: PageContent = { ...base, figures: [fig] };
    expect(baseline(withFig, 'paragraph-2')).toBe(baseline(base, 'paragraph-2'));
  });

  it('works on frontispiece and chapter flows too', () => {
    for (const type of ['frontispiece', 'chapter'] as const) {
      const p: PageContent = { ...base, type, figures: [{ ...fig, beforeParagraph: 0 }] };
      const plain: PageContent = { ...base, type };
      expect(baseline(p, 'paragraph-0')).toBe(baseline(plain, 'paragraph-0') + figureAdvance(fig));
    }
  });

  it('figureRect spans the column and sits above the next baseline', () => {
    const r = figureRect(fig, 150, 1000, 700);
    expect(r).toEqual({ x: 150, y: 672, width: 1000, height: 400 });
    expect(r.y + figureAdvance(fig)).toBe(700 - 28 + figureAdvance(fig));
  });

  it('collects every image url a page needs', () => {
    expect(pageImageUrls({ ...base, imageUrl: '/a', figures: [fig, { url: '/g' }] })).toEqual(['/a', '/f.png', '/g']);
    expect(pageImageUrls(base)).toEqual([]);
  });

  it('import validation checks figure shape', () => {
    const ok = validateImportedPages([{ ...base, figures: [{ url: '/x', beforeParagraph: 1, height: 300, fit: 'contain', caption: 'c' }] }], 1);
    expect(ok.ok).toBe(true);
    for (const bad of [{ url: 3 }, { url: '/x', beforeParagraph: 1.5 }, { url: '/x', height: -1 }, { url: '/x', fit: 'z' }, { url: '/x', caption: 1 }]) {
      expect(validateImportedPages([{ ...base, figures: [bad] }], 1).ok).toBe(false);
    }
    expect(validateImportedPages([{ ...base, figures: 'x' }], 1).ok).toBe(false);
  });
});
