import { PageContent } from './chinesePublicationData';
import { TextStyle, getFontEpoch, hasText, lineTop, textLines } from './textMetrics';

export type EditableElementType =
  | 'title'
  | 'subtitle'
  | 'author'
  | 'chapterNumber'
  | 'paragraph'
  | 'poetryLine'
  | 'seal'
  | 'header'
  | 'note'
  | 'tocItem'
  | 'colophonItem';

export interface PageLayoutElement {
  id: string;
  type: EditableElementType;
  label: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pageIndex: number;
  text: string;
  /** 与渲染器共用的绘制样式，用于光标/选区/点击定位 */
  style: TextStyle;
  maxLength?: number;
  paragraphIndex?: number;
  poetryIndex?: number;
  noteIndex?: number;
  tocIndex?: number;
  colophonIndex?: number;
}

export const CANVAS_WIDTH = 1440;
export const CANVAS_HEIGHT = 1983; // CANVAS_WIDTH * SHEET_ASPECT

const PAD = 6;

type Extra = Partial<
  Pick<
    PageLayoutElement,
    'maxLength' | 'paragraphIndex' | 'poetryIndex' | 'noteIndex' | 'tocIndex' | 'colophonIndex'
  >
>;

function style(
  fontSize: number,
  weight: TextStyle['weight'],
  align: TextStyle['align'],
  anchorX: number,
  baselineY: number,
  rest: Partial<TextStyle> = {}
): TextStyle {
  return {
    fontSize,
    weight,
    align,
    anchorX,
    baselineY,
    baseline: 'alphabetic',
    lineHeight: fontSize * 1.3,
    ...rest,
  };
}

function lineBox(s: TextStyle, x: number, width: number) {
  return { x, y: lineTop(s, 0) - PAD, width, height: s.fontSize * 1.25 + PAD * 2 };
}

/**
 * 计算页面中各排印元素的 2D 包围盒及绘制样式。
 * 所有步长/字号必须与 pageRenderer 的绘制保持一致（单测校验）。
 */
export function getPageLayoutElements(page: PageContent, pageIndex: number): PageLayoutElement[] {
  const out: PageLayoutElement[] = [];
  const W = CANVAS_WIDTH;

  const isLeftPage = page.sideIndex % 2 === 0;
  const contentLeft = isLeftPage ? 160 : 150;
  const contentRight = isLeftPage ? W - 150 : W - 160;
  const contentWidth = contentRight - contentLeft;

  const line = (
    id: string,
    type: EditableElementType,
    label: string,
    text: string,
    s: TextStyle,
    x: number,
    width: number,
    extra: Extra = {}
  ) => {
    out.push({ id, type, label, text, style: s, pageIndex, bounds: lineBox(s, x, width), ...extra });
  };

  /** 多行段落，返回占用的行数 */
  const block = (
    idx: number,
    label: string,
    text: string,
    s: TextStyle,
    x: number,
    width: number
  ): number => {
    const n = textLines(s, text).lines.length;
    out.push({
      id: `paragraph-${idx}`,
      type: 'paragraph',
      label,
      text,
      style: s,
      pageIndex,
      paragraphIndex: idx,
      bounds: {
        x,
        y: lineTop(s, 0) - PAD,
        width,
        height: (n - 1) * s.lineHeight + s.fontSize * 1.25 + PAD * 2,
      },
    });
    return n;
  };

  const seal = (text: string, cx: number, cy: number, size: number, label: string) => {
    const half = size / 2 + PAD;
    out.push({
      id: 'seal',
      type: 'seal',
      label,
      text,
      pageIndex,
      maxLength: 4,
      style: style(size * 0.38, 'bold', 'center', cx, cy),
      bounds: { x: cx - half, y: cy - half, width: half * 2, height: half * 2 },
    });
  };

  // 1. 封面
  if (page.type === 'cover') {
    const labelX = W * 0.68;
    const labelY = 220;
    const labelW = 160;
    const labelH = 820;
    out.push({
      id: 'title',
      type: 'title',
      label: '封面题签书名',
      text: page.title || '',
      pageIndex,
      maxLength: 8,
      style: style(68, 'bold', 'center', labelX + labelW / 2, labelY + 60, {
        baseline: 'top',
        lineHeight: 92,
        vertical: { step: 92 },
      }),
      bounds: { x: labelX - 10, y: labelY - 10, width: labelW + 20, height: labelH + 20 },
    });

    const subX = 220;
    let subY = 680;
    if (hasText(page.subtitle)) {
      const s = style(34, 500, 'left', subX, subY, { baseline: 'top' });
      line('subtitle', 'subtitle', '封面副标题', page.subtitle, s, subX - 15, 440);
      subY += 60;
    }
    if (hasText(page.author)) {
      const s = style(28, 400, 'left', subX, subY, { baseline: 'top' });
      line('author', 'author', '著作者', page.author, s, subX - 15, 360);
    }
    seal(page.sealText || '文心典藏', subX + 46, subY + 120, 84, '朱砂印章');
    return out;
  }

  // 2. 封底版权页
  if (page.type === 'colophon') {
    const boxW = 860;
    const boxH = 920;
    const boxX = (W - boxW) / 2;
    const boxY = (CANVAS_HEIGHT - boxH) / 2;

    const ts = style(42, 'bold', 'center', W / 2, boxY + 80);
    line('title', 'title', '版权页标题', page.title || '图书在版编目（ＣＩＰ）数据', ts, boxX + 60, boxW - 120);

    let cy = boxY + 190;
    page.colophonDetails?.forEach((item, idx) => {
      const s = style(28, 400, 'left', boxX + 280, cy);
      line(`colophon-${idx}`, 'colophonItem', item.key, item.value, s, boxX + 270, boxW - 330, {
        colophonIndex: idx,
      });
      cy += 54;
    });

    seal(page.sealText || '文心出版', W / 2, boxY + boxH - 120, 72, '出版印章');
    return out;
  }

  // 3. 书眉
  if (hasText(page.headerText)) {
    const s = style(
      24,
      400,
      isLeftPage ? 'left' : 'right',
      isLeftPage ? contentLeft : contentRight,
      127
    );
    line('header', 'header', '书眉顶标', page.headerText, s, contentLeft - 10, contentWidth + 20);
  }

  // 4. 扉页
  if (page.type === 'frontispiece') {
    let y = 420;
    line('title', 'title', '扉页书名', page.title || '', style(54, 'bold', 'center', W / 2, y), W / 2 - 320, 640);
    if (hasText(page.subtitle)) {
      y += 70;
      line('subtitle', 'subtitle', '扉页副标题', page.subtitle, style(28, 400, 'center', W / 2, y), W / 2 - 260, 520);
    }
    y += 120;
    const pWidth = 840;
    const pLeft = (W - pWidth) / 2;
    page.paragraphs?.forEach((p, idx) => {
      const s = style(32, 400, 'left', pLeft, y, { lineHeight: 58, maxWidth: pWidth, prefix: '　　' });
      const n = block(idx, `题记段落 ${idx + 1}`, p, s, pLeft - 15, pWidth + 30);
      y += n * 58 + 28;
    });
    if (hasText(page.sealText)) seal(page.sealText, W / 2, y + 60, 68, '朱砂印章');
    return out;
  }

  // 5. 目录
  if (page.type === 'toc') {
    let y = 240;
    line('title', 'title', '目录标题', page.title || '', style(56, 'bold', 'center', W / 2, y), W / 2 - 200, 400);
    if (hasText(page.subtitle)) {
      y += 50;
      line('subtitle', 'subtitle', '目次副题', page.subtitle, style(22, 500, 'center', W / 2, y), W / 2 - 180, 360);
    }
    y += 140;
    page.tocItems?.forEach((item, idx) => {
      const s = style(32, 500, 'left', contentLeft, y);
      line(`toc-${idx}`, 'tocItem', `篇目 ${idx + 1} · ${item.title}`, item.title, s, contentLeft - 15, contentWidth + 30, {
        tocIndex: idx,
      });
      y += 84;
    });
    return out;
  }

  // 6. 章节扉页
  if (page.type === 'chapter') {
    let y = 480;
    if (hasText(page.chapterNumber)) {
      line('chapterNumber', 'chapterNumber', '章节序号', page.chapterNumber, style(32, 'bold', 'center', W / 2, y), W / 2 - 180, 360);
      y += 60;
    }
    line('title', 'title', '章节主标题', page.title || '', style(64, 'bold', 'center', W / 2, y), W / 2 - 360, 720);
    if (hasText(page.subtitle)) {
      y += 64;
      line('subtitle', 'subtitle', '章节副题', page.subtitle, style(28, 400, 'center', W / 2, y), W / 2 - 250, 500);
    }
    if (hasText(page.author)) {
      y += 54;
      line('author', 'author', '作者', page.author, style(30, 500, 'center', W / 2, y), W / 2 - 200, 400);
    }
    y += 120;
    const dWidth = 780;
    const dLeft = (W - dWidth) / 2;
    page.paragraphs?.forEach((p, idx) => {
      const s = style(30, 400, 'left', dLeft, y, { lineHeight: 56, maxWidth: dWidth, prefix: '　　' });
      const n = block(idx, `导语段落 ${idx + 1}`, p, s, dLeft - 15, dWidth + 30);
      y += n * 56;
    });
    if (hasText(page.sealText)) seal(page.sealText, W / 2, y + 80, 72, '朱砂印章');
    return out;
  }

  // 7. 诗歌页
  if (page.type === 'poetry') {
    let y = 260;
    line('title', 'title', '诗篇题名', page.title || '', style(48, 'bold', 'center', W / 2, y), W / 2 - 260, 520);
    if (hasText(page.subtitle)) {
      y += 48;
      line('subtitle', 'subtitle', '诗序小引', page.subtitle, style(26, 400, 'center', W / 2, y), W / 2 - 220, 440);
    }
    if (hasText(page.author)) {
      y += 46;
      line('author', 'author', '诗人名号', page.author, style(28, 400, 'center', W / 2, y), W / 2 - 180, 360);
    }
    y += 80;
    page.poetryLines?.forEach((l, idx) => {
      if (l === '') {
        y += 36;
        return;
      }
      line(`poetry-${idx}`, 'poetryLine', `诗句 ${idx + 1}`, l, style(32, 400, 'center', W / 2, y), W / 2 - 320, 640, {
        poetryIndex: idx,
      });
      y += 56;
    });
    return out;
  }

  // 8. 默认散文页
  let y = 220;
  if (hasText(page.title)) {
    line('title', 'title', '文章篇名', page.title, style(40, 'bold', 'left', contentLeft, y), contentLeft - 15, contentWidth + 30);
    y += 70;
  }
  page.paragraphs?.forEach((p, idx) => {
    const s = style(31, 400, 'left', contentLeft, y, { lineHeight: 60, maxWidth: contentWidth, prefix: '　　' });
    const n = block(idx, `正文段落 ${idx + 1}`, p, s, contentLeft - 15, contentWidth + 30);
    y += n * 60 + 26;
  });

  let ny = CANVAS_HEIGHT - 320 + 36;
  page.notes?.forEach((n, idx) => {
    line(`note-${idx}`, 'note', `注释 ${idx + 1}`, n, style(24, 400, 'left', contentLeft, ny), contentLeft - 15, contentWidth + 30, {
      noteIndex: idx,
    });
    ny += 38;
  });

  return out;
}

const layoutCache = new WeakMap<
  PageContent,
  { pageIndex: number; epoch: number; elements: PageLayoutElement[] }
>();

/** 带缓存的版式计算：同一份页面数据（不可变更新）只算一次 */
export function getCachedLayoutElements(page: PageContent, pageIndex: number): PageLayoutElement[] {
  const epoch = getFontEpoch();
  const hit = layoutCache.get(page);
  if (hit && hit.pageIndex === pageIndex && hit.epoch === epoch) return hit.elements;
  const elements = getPageLayoutElements(page, pageIndex);
  layoutCache.set(page, { pageIndex, epoch, elements });
  return elements;
}

/**
 * 碰撞检测：查找坐标 (x, y) 所命中的版式元素
 */
export function findLayoutElementAtCoords(
  elements: PageLayoutElement[],
  x: number,
  y: number
): PageLayoutElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const { bounds } = elements[i];
    if (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    ) {
      return elements[i];
    }
  }
  return null;
}
