import { describe, it, expect } from 'vitest';
import { PageContent } from '../chinesePublicationData';
import { buildRuns } from './readerDoc';
import { findMatches, firstMatchFrom, sheetOfPage } from './search';

const pg = (sideIndex: number, paragraphs: string[]): PageContent => ({ type: 'spread', sideIndex, title: 'X', paragraphs });

describe('search', () => {
  const pages = [pg(1, ['天地人，天']), pg(2, ['人和']), pg(3, ['天'])];
  const runs = buildRuns(pages, [0, 1, 2]);
  it('finds every non-overlapping match per element', () => {
    const m = findMatches(runs, '天');
    expect(m.map((x) => [x.pageIndex, x.from])).toEqual([[0, 0], [0, 4], [2, 0]]);
  });
  it('is empty for an empty query', () => {
    expect(findMatches(runs, '')).toEqual([]);
  });
  it('picks the first match at or after a page, wrapping around', () => {
    const m = findMatches(runs, '人');
    expect(firstMatchFrom(m, 1)).toBe(1);
    expect(firstMatchFrom(m, 2)).toBe(0);
    expect(firstMatchFrom([], 0)).toBe(-1);
  });
  it('maps page index to its sheet', () => {
    expect([0, 1, 2, 3, 4].map(sheetOfPage)).toEqual([0, 1, 1, 2, 2]);
  });
});
