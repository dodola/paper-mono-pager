import { PageContent } from './chinesePublicationData';

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
  paragraphIndex?: number;
  poetryIndex?: number;
  noteIndex?: number;
  tocIndex?: number;
  colophonIndex?: number;
}

const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 1983;

// 中文避头尾折行预估算法 (用于纯几何无 Canvas 上下文时的包围盒测算)
export function estimateWrappedLineCount(
  text: string,
  maxWidth: number,
  charWidth: number
): number {
  const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
  let count = 0;
  const rawLines = text.split('\n');
  for (const raw of rawLines) {
    if (raw.length === 0) {
      count += 1;
    } else {
      count += Math.ceil(raw.length / charsPerLine);
    }
  }
  return Math.max(1, count);
}

/**
 * 计算页面中各排印元素的精确 2D 坐标包围盒
 */
export function getPageLayoutElements(
  page: PageContent,
  pageIndex: number
): PageLayoutElement[] {
  const elements: PageLayoutElement[] = [];

  const isLeftPage = page.sideIndex % 2 === 0;
  const spineMargin = 150;
  const outerMargin = 160;
  const contentLeft = isLeftPage ? outerMargin : spineMargin;
  const contentRight = isLeftPage ? CANVAS_WIDTH - spineMargin : CANVAS_WIDTH - outerMargin;
  const contentWidth = contentRight - contentLeft;

  // 1. 封面 (Cover)
  if (page.type === 'cover') {
    // 书名题签框
    const labelX = CANVAS_WIDTH * 0.68;
    const labelY = 220;
    const labelW = 160;
    const labelH = 820;
    elements.push({
      id: 'title',
      type: 'title',
      label: '封面题签书名',
      bounds: { x: labelX - 10, y: labelY - 10, width: labelW + 20, height: labelH + 20 },
      pageIndex,
      text: page.title || '',
    });

    // 副标题
    const subX = 220;
    let subY = 680;
    if (page.subtitle) {
      elements.push({
        id: 'subtitle',
        type: 'subtitle',
        label: '封面副标题',
        bounds: { x: subX - 15, y: subY - 40, width: 440, height: 60 },
        pageIndex,
        text: page.subtitle,
      });
      subY += 60;
    }

    // 作者
    if (page.author) {
      elements.push({
        id: 'author',
        type: 'author',
        label: '著作者',
        bounds: { x: subX - 15, y: subY - 35, width: 360, height: 55 },
        pageIndex,
        text: page.author,
      });
    }

    // 朱砂印章
    const sealX = subX + 46;
    const sealY = subY + 120;
    elements.push({
      id: 'seal',
      type: 'seal',
      label: '朱砂印章',
      bounds: { x: sealX - 48, y: sealY - 48, width: 96, height: 96 },
      pageIndex,
      text: page.sealText || '文心典藏',
    });

    return elements;
  }

  // 2. 封底版权页 (Colophon)
  if (page.type === 'colophon') {
    const boxW = 860;
    const boxH = 920;
    const boxX = (CANVAS_WIDTH - boxW) / 2;
    const boxY = (CANVAS_HEIGHT - boxH) / 2;

    elements.push({
      id: 'title',
      type: 'title',
      label: '版权页标题',
      bounds: { x: boxX + 60, y: boxY + 30, width: boxW - 120, height: 70 },
      pageIndex,
      text: page.title || '图书在版编目（ＣＩＰ）数据',
    });

    let cy = boxY + 190;
    if (page.colophonDetails) {
      page.colophonDetails.forEach((item, idx) => {
        elements.push({
          id: `colophon-${idx}`,
          type: 'colophonItem',
          label: `${item.key}`,
          bounds: { x: boxX + 60, y: cy - 35, width: boxW - 120, height: 50 },
          pageIndex,
          text: item.value,
          colophonIndex: idx,
        });
        cy += 54;
      });
    }

    // 印章
    elements.push({
      id: 'seal',
      type: 'seal',
      label: '出版印章',
      bounds: { x: CANVAS_WIDTH / 2 - 45, y: boxY + boxH - 120 - 45, width: 90, height: 90 },
      pageIndex,
      text: page.sealText || '文心出版',
    });

    return elements;
  }

  // 3. 通用书眉 (Running Header)
  if (page.headerText) {
    elements.push({
      id: 'header',
      type: 'header',
      label: '书眉顶标',
      bounds: { x: contentLeft - 10, y: 90, width: contentWidth + 20, height: 54 },
      pageIndex,
      text: page.headerText,
    });
  }

  // 4. 扉页 (Frontispiece)
  if (page.type === 'frontispiece') {
    let startY = 420;
    elements.push({
      id: 'title',
      type: 'title',
      label: '扉页书名',
      bounds: { x: CANVAS_WIDTH / 2 - 320, y: startY - 55, width: 640, height: 80 },
      pageIndex,
      text: page.title || '',
    });

    if (page.subtitle) {
      startY += 70;
      elements.push({
        id: 'subtitle',
        type: 'subtitle',
        label: '扉页副标题',
        bounds: { x: CANVAS_WIDTH / 2 - 260, y: startY - 35, width: 520, height: 55 },
        pageIndex,
        text: page.subtitle,
      });
    }

    startY += 120;
    const pWidth = 840;
    const pLeft = (CANVAS_WIDTH - pWidth) / 2;
    if (page.paragraphs) {
      page.paragraphs.forEach((p, idx) => {
        const lineCount = estimateWrappedLineCount('　　' + p, pWidth, 32);
        const pHeight = lineCount * 58 + 20;
        elements.push({
          id: `paragraph-${idx}`,
          type: 'paragraph',
          label: `题记段落 ${idx + 1}`,
          bounds: { x: pLeft - 15, y: startY - 35, width: pWidth + 30, height: pHeight },
          pageIndex,
          paragraphIndex: idx,
          text: p,
        });
        startY += pHeight + 28;
      });
    }

    if (page.sealText) {
      elements.push({
        id: 'seal',
        type: 'seal',
        label: '朱砂印章',
        bounds: { x: CANVAS_WIDTH / 2 - 42, y: startY + 60 - 42, width: 84, height: 84 },
        pageIndex,
        text: page.sealText,
      });
    }

    return elements;
  }

  // 5. 目录 (TOC)
  if (page.type === 'toc') {
    let startY = 240;
    elements.push({
      id: 'title',
      type: 'title',
      label: '目录标题',
      bounds: { x: CANVAS_WIDTH / 2 - 200, y: startY - 55, width: 400, height: 75 },
      pageIndex,
      text: page.title || '',
    });

    if (page.subtitle) {
      startY += 50;
      elements.push({
        id: 'subtitle',
        type: 'subtitle',
        label: '目次副题',
        bounds: { x: CANVAS_WIDTH / 2 - 180, y: startY - 30, width: 360, height: 45 },
        pageIndex,
        text: page.subtitle,
      });
    }

    startY += 140;
    if (page.tocItems) {
      page.tocItems.forEach((item, idx) => {
        elements.push({
          id: `toc-${idx}`,
          type: 'tocItem',
          label: `篇目 ${idx + 1} · ${item.title}`,
          bounds: { x: contentLeft - 15, y: startY - 35, width: contentWidth + 30, height: 60 },
          pageIndex,
          tocIndex: idx,
          text: item.title,
        });
        startY += 84;
      });
    }

    return elements;
  }

  // 6. 章节扉页 (Chapter)
  if (page.type === 'chapter') {
    let startY = 480;
    if (page.chapterNumber) {
      elements.push({
        id: 'chapterNumber',
        type: 'chapterNumber',
        label: '章节序号',
        bounds: { x: CANVAS_WIDTH / 2 - 180, y: startY - 35, width: 360, height: 50 },
        pageIndex,
        text: page.chapterNumber,
      });
      startY += 60;
    }

    elements.push({
      id: 'title',
      type: 'title',
      label: '章节主标题',
      bounds: { x: CANVAS_WIDTH / 2 - 360, y: startY - 60, width: 720, height: 85 },
      pageIndex,
      text: page.title || '',
    });

    if (page.subtitle) {
      startY += 64;
      elements.push({
        id: 'subtitle',
        type: 'subtitle',
        label: '章节副题',
        bounds: { x: CANVAS_WIDTH / 2 - 250, y: startY - 35, width: 500, height: 50 },
        pageIndex,
        text: page.subtitle,
      });
    }

    if (page.author) {
      startY += 54;
      elements.push({
        id: 'author',
        type: 'author',
        label: '作者',
        bounds: { x: CANVAS_WIDTH / 2 - 200, y: startY - 35, width: 400, height: 50 },
        pageIndex,
        text: page.author,
      });
    }

    startY += 120;
    const descWidth = 780;
    const descLeft = (CANVAS_WIDTH - descWidth) / 2;
    if (page.paragraphs) {
      page.paragraphs.forEach((p, idx) => {
        const lineCount = estimateWrappedLineCount('　　' + p, descWidth, 30);
        const pHeight = lineCount * 56 + 10;
        elements.push({
          id: `paragraph-${idx}`,
          type: 'paragraph',
          label: `导语段落 ${idx + 1}`,
          bounds: { x: descLeft - 15, y: startY - 35, width: descWidth + 30, height: pHeight },
          pageIndex,
          paragraphIndex: idx,
          text: p,
        });
        startY += pHeight + 20;
      });
    }

    if (page.sealText) {
      elements.push({
        id: 'seal',
        type: 'seal',
        label: '朱砂印章',
        bounds: { x: CANVAS_WIDTH / 2 - 45, y: startY + 80 - 45, width: 90, height: 90 },
        pageIndex,
        text: page.sealText,
      });
    }

    return elements;
  }

  // 7. 诗歌页 (Poetry)
  if (page.type === 'poetry') {
    let startY = 260;
    elements.push({
      id: 'title',
      type: 'title',
      label: '诗篇题名',
      bounds: { x: CANVAS_WIDTH / 2 - 260, y: startY - 50, width: 520, height: 70 },
      pageIndex,
      text: page.title || '',
    });

    if (page.subtitle) {
      startY += 48;
      elements.push({
        id: 'subtitle',
        type: 'subtitle',
        label: '诗序小引',
        bounds: { x: CANVAS_WIDTH / 2 - 220, y: startY - 30, width: 440, height: 48 },
        pageIndex,
        text: page.subtitle,
      });
    }

    if (page.author) {
      startY += 46;
      elements.push({
        id: 'author',
        type: 'author',
        label: '诗人名号',
        bounds: { x: CANVAS_WIDTH / 2 - 180, y: startY - 30, width: 360, height: 48 },
        pageIndex,
        text: page.author,
      });
    }

    startY += 80;
    if (page.poetryLines) {
      page.poetryLines.forEach((line, idx) => {
        if (line !== '') {
          elements.push({
            id: `poetry-${idx}`,
            type: 'poetryLine',
            label: `诗句 ${idx + 1}`,
            bounds: { x: CANVAS_WIDTH / 2 - 320, y: startY - 35, width: 640, height: 54 },
            pageIndex,
            poetryIndex: idx,
            text: line,
          });
          startY += 56;
        } else {
          startY += 36;
        }
      });
    }

    return elements;
  }

  // 8. 默认散文与通栏排印页 (Spread)
  let startY = 220;
  if (page.title) {
    elements.push({
      id: 'title',
      type: 'title',
      label: '文章篇名',
      bounds: { x: contentLeft - 15, y: startY - 45, width: contentWidth + 30, height: 65 },
      pageIndex,
      text: page.title,
    });
    startY += 70;
  }

  if (page.paragraphs) {
    page.paragraphs.forEach((p, idx) => {
      const lineCount = estimateWrappedLineCount('　　' + p, contentWidth, 31);
      const pHeight = lineCount * 60 + 10;
      elements.push({
        id: `paragraph-${idx}`,
        type: 'paragraph',
        label: `正文段落 ${idx + 1}`,
        bounds: { x: contentLeft - 15, y: startY - 35, width: contentWidth + 30, height: pHeight },
        pageIndex,
        paragraphIndex: idx,
        text: p,
      });
      startY += pHeight + 26;
    });
  }

  // 脚注
  if (page.notes && page.notes.length > 0) {
    let ny = CANVAS_HEIGHT - 320 + 36;
    page.notes.forEach((n, idx) => {
      elements.push({
        id: `note-${idx}`,
        type: 'note',
        label: `注释 ${idx + 1}`,
        bounds: { x: contentLeft - 15, y: ny - 30, width: contentWidth + 30, height: 42 },
        pageIndex,
        noteIndex: idx,
        text: n,
      });
      ny += 38;
    });
  }

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
    const el = elements[i];
    const { bounds } = el;
    if (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    ) {
      return el;
    }
  }
  return null;
}
