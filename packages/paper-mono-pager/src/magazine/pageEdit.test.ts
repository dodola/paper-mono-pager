import { describe, it, expect } from 'vitest';
import { PageContent } from './chinesePublicationData';
import {
  insertParagraph,
  removeParagraph,
  splitParagraph,
  mergeWithPrevious,
  validateImportedPages,
  supportsParagraphs,
} from './pageEdit';

const page: PageContent = { type: 'spread', sideIndex: 3, title: 'T', paragraphs: ['甲乙丙', '丁'] };

describe('paragraph editing', () => {
  it('inserts after an index without mutating the source', () => {
    const r = insertParagraph(page, 0);
    expect(r.page.paragraphs).toEqual(['甲乙丙', '', '丁']);
    expect(r.focusId).toBe('paragraph-1');
    expect(page.paragraphs).toEqual(['甲乙丙', '丁']);
  });

  it('inserts into a page with no paragraphs', () => {
    const r = insertParagraph({ ...page, paragraphs: undefined }, null);
    expect(r.page.paragraphs).toEqual(['']);
  });

  it('removes and refocuses a neighbour; none left -> null', () => {
    expect(removeParagraph(page, 1).focusId).toBe('paragraph-0');
    const only = removeParagraph({ ...page, paragraphs: ['x'] }, 0);
    expect(only.page.paragraphs).toEqual([]);
    expect(only.focusId).toBeNull();
  });

  it('splits at the caret and focuses the tail at offset 0', () => {
    const r = splitParagraph(page, 0, 1)!;
    expect(r.page.paragraphs).toEqual(['甲', '乙丙', '丁']);
    expect(r.focusId).toBe('paragraph-1');
    expect(r.caret).toBe(0);
  });

  it('merges with the previous paragraph and puts the caret at the seam', () => {
    const r = mergeWithPrevious(page, 1)!;
    expect(r.page.paragraphs).toEqual(['甲乙丙丁']);
    expect(r.focusId).toBe('paragraph-0');
    expect(r.caret).toBe(3);
    expect(mergeWithPrevious(page, 0)).toBeNull();
  });

  it('only prose-like pages take paragraphs', () => {
    expect(supportsParagraphs(page)).toBe(true);
    expect(supportsParagraphs({ ...page, type: 'poetry' })).toBe(false);
  });
});

describe('validateImportedPages', () => {
  const good = [page, { ...page, sideIndex: 4 }];

  it('accepts a matching, well-formed book', () => {
    expect(validateImportedPages(good, 2).ok).toBe(true);
  });

  it('rejects wrong page count', () => {
    const r = validateImportedPages(good, 3);
    expect(r.ok).toBe(false);
  });

  it('rejects malformed pages instead of crashing the renderer later', () => {
    expect(validateImportedPages([{ ...page, type: 'x' }, page], 2).ok).toBe(false);
    expect(validateImportedPages([{ ...page, title: undefined }, page], 2).ok).toBe(false);
    expect(validateImportedPages([{ ...page, paragraphs: [1] }, page], 2).ok).toBe(false);
    expect(validateImportedPages('nope', 2).ok).toBe(false);
  });
});
