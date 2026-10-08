import { PageContent } from './chinesePublicationData';

const PAGE_TYPES: PageContent['type'][] = [
  'cover',
  'frontispiece',
  'toc',
  'chapter',
  'spread',
  'poetry',
  'colophon',
];

export interface EditResult {
  page: PageContent;
  /** 编辑后应聚焦的元素 id 与光标下标 */
  focusId: string | null;
  caret: number;
}

export function supportsParagraphs(page: PageContent): boolean {
  return page.type === 'spread' || page.type === 'frontispiece' || page.type === 'chapter';
}

export function insertParagraph(page: PageContent, afterIndex: number | null, text = ''): EditResult {
  const list = [...(page.paragraphs ?? [])];
  const at = afterIndex === null ? list.length : Math.min(afterIndex + 1, list.length);
  list.splice(at, 0, text);
  return { page: { ...page, paragraphs: list }, focusId: `paragraph-${at}`, caret: 0 };
}

export function removeParagraph(page: PageContent, index: number): EditResult {
  const list = page.paragraphs ?? [];
  if (index < 0 || index >= list.length) return { page, focusId: null, caret: 0 };
  const next = list.filter((_, i) => i !== index);
  const focusIdx = Math.min(index, next.length - 1);
  return {
    page: { ...page, paragraphs: next },
    focusId: focusIdx >= 0 ? `paragraph-${focusIdx}` : null,
    caret: 0,
  };
}

/** 在 at 处把段落一分为二（Enter） */
export function splitParagraph(page: PageContent, index: number, at: number): EditResult | null {
  const list = page.paragraphs;
  if (!list || index < 0 || index >= list.length) return null;
  const text = list[index];
  const next = [...list];
  next.splice(index, 1, text.slice(0, at), text.slice(at));
  return { page: { ...page, paragraphs: next }, focusId: `paragraph-${index + 1}`, caret: 0 };
}

/** 行首退格：并入上一段 */
export function mergeWithPrevious(page: PageContent, index: number): EditResult | null {
  const list = page.paragraphs;
  if (!list || index <= 0 || index >= list.length) return null;
  const caret = list[index - 1].length;
  const next = [...list];
  next.splice(index - 1, 2, list[index - 1] + list[index]);
  return { page: { ...page, paragraphs: next }, focusId: `paragraph-${index - 1}`, caret };
}

const isStr = (v: unknown) => typeof v === 'string';
const isStrArr = (v: unknown) => Array.isArray(v) && v.every(isStr);

export type ValidateResult = { ok: true; pages: PageContent[] } | { ok: false; error: string };

/** 导入校验：结构必须合法，且页数与现有书册一致（印张数量固定） */
export function validateImportedPages(input: unknown, expectedLength: number): ValidateResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: '导入的内容必须是包含书籍页面对象的 JSON 数组' };
  }
  if (input.length !== expectedLength) {
    return { ok: false, error: `页数必须与当前书册一致（${expectedLength} 页），导入内容为 ${input.length} 页` };
  }
  for (let i = 0; i < input.length; i++) {
    const p = input[i] as Record<string, unknown> | null;
    const at = `第 ${i + 1} 页`;
    if (!p || typeof p !== 'object') return { ok: false, error: `${at}不是对象` };
    if (!PAGE_TYPES.includes(p.type as PageContent['type'])) return { ok: false, error: `${at}：type 无效` };
    if (typeof p.sideIndex !== 'number') return { ok: false, error: `${at}：缺少数字 sideIndex` };
    if (!isStr(p.title)) return { ok: false, error: `${at}：缺少字符串 title` };
    for (const k of ['subtitle', 'author', 'chapterNumber', 'headerText', 'sealText']) {
      if (p[k] !== undefined && !isStr(p[k])) return { ok: false, error: `${at}：${k} 必须是字符串` };
    }
    for (const k of ['paragraphs', 'poetryLines', 'notes']) {
      if (p[k] !== undefined && !isStrArr(p[k])) return { ok: false, error: `${at}：${k} 必须是字符串数组` };
    }
    const toc = p.tocItems;
    if (toc !== undefined && !(Array.isArray(toc) && toc.every((t) => t && isStr(t.title) && isStr(t.author) && isStr(t.page)))) {
      return { ok: false, error: `${at}：tocItems 结构无效` };
    }
    const col = p.colophonDetails;
    if (col !== undefined && !(Array.isArray(col) && col.every((t) => t && isStr(t.key) && isStr(t.value)))) {
      return { ok: false, error: `${at}：colophonDetails 结构无效` };
    }
  }
  return { ok: true, pages: input as PageContent[] };
}
