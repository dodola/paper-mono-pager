import { describe, it, expect } from 'vitest';
import { PageContent } from '../chinesePublicationData';
import { buildRuns } from './readerDoc';
import { Annotation, resolveAnnotations, createAnnotations, removeGroup } from './annotations';

const pg = (paragraphs: string[]): PageContent => ({ type: 'spread', sideIndex: 2, title: 'T', paragraphs });

describe('annotations', () => {
  const pages = [pg(['天地玄黄，宇宙洪荒。', '日月盈昃。'])];
  const runs = buildRuns(pages, [0]);

  it('creates one annotation per segment sharing a group', () => {
    const list = createAnnotations(
      runs,
      { pageIndex: 0, elementId: 'paragraph-0', offset: 4 },
      { pageIndex: 0, elementId: 'paragraph-1', offset: 2 },
      { type: 'highlight', color: '#F2C94C' },
      () => 'g1'
    );
    expect(list).toHaveLength(2);
    expect(new Set(list.map((a) => a.groupId)).size).toBe(1);
    expect(list[0].quote).toBe('，宇宙洪荒。');
    expect(list[1].quote).toBe('日月');
  });

  it('resolves unchanged text at its stored range', () => {
    const [a] = createAnnotations(
      runs,
      { pageIndex: 0, elementId: 'paragraph-0', offset: 0 },
      { pageIndex: 0, elementId: 'paragraph-0', offset: 4 },
      { type: 'underline', color: '#000' },
      () => 'g'
    );
    const out = resolveAnnotations([a], runs);
    expect(out[0].from).toBe(0);
    expect(out[0].to).toBe(4);
  });

  it('re-anchors by quote after the text shifted', () => {
    const [a] = createAnnotations(
      runs,
      { pageIndex: 0, elementId: 'paragraph-0', offset: 5 },
      { pageIndex: 0, elementId: 'paragraph-0', offset: 9 },
      { type: 'wave', color: '#000' },
      () => 'g'
    );
    const edited = buildRuns([pg(['前缀' + '天地玄黄，宇宙洪荒。', '日月盈昃。'])], [0]);
    const out = resolveAnnotations([a], edited);
    expect(out).toHaveLength(1);
    expect(out[0].from).toBe(7);
    expect(edited[1].text.slice(out[0].from, out[0].to)).toBe(a.quote);
  });

  it('drops annotations whose quote vanished', () => {
    const a: Annotation = {
      id: 'x', groupId: 'g', type: 'highlight', color: '#fff', pageIndex: 0,
      elementId: 'paragraph-0', start: 0, end: 2, quote: '不存在', createdAt: 0,
    };
    expect(resolveAnnotations([a], runs)).toHaveLength(0);
  });

  it('removeGroup removes every segment', () => {
    const list = createAnnotations(
      runs,
      { pageIndex: 0, elementId: 'paragraph-0', offset: 4 },
      { pageIndex: 0, elementId: 'paragraph-1', offset: 2 },
      { type: 'highlight', color: '#F2C94C' },
      () => 'g1'
    );
    expect(removeGroup(list, 'g1')).toEqual([]);
  });
});
