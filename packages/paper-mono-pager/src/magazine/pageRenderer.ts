import { PageContent } from './chinesePublicationData';
import { CANVAS_WIDTH, CANVAS_HEIGHT, getCachedLayoutElements } from './pageLayout';
import {
  WENKAI_FONT,
  hasText,
  wrapText,
  caretGeometry,
  selectionRects,
  type Rect,
  type TextStyle,
} from './textMetrics';
import { buildSelectionShape, traceSegments, rgba } from './selectionShape';
import { drawFigures, drawPageImage, getCachedPageImage } from './pageImages';

export interface RenderOptions {
  paperColor?: string;
  textColor?: string;
  accentColor?: string;
}

export interface PageEditState {
  hoveredElementId?: string | null;
  activeElementId?: string | null;
  caretVisible?: boolean;
  /** 激活元素内的选区（字符下标），相等表示插入点 */
  selectionStart?: number;
  selectionEnd?: number;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  paperColor: '#F9F7F2', // 经典书籍米纸色
  textColor: '#242220',  // 墨黑
  accentColor: '#9B2D26', // 朱砂红
};

// 绘制中式朱砂印章
function drawSeal(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 72,
  color = '#9B2D26'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.strokeRect(x - size / 2, y - size / 2, size, size);

  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size * 0.38)}px ${WENKAI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (text.length === 2) {
    ctx.fillText(text[0], x, y - size * 0.22);
    ctx.fillText(text[1], x, y + size * 0.22);
  } else if (text.length === 4) {
    ctx.fillText(text[0], x + size * 0.22, y - size * 0.22);
    ctx.fillText(text[1], x + size * 0.22, y + size * 0.22);
    ctx.fillText(text[2], x - size * 0.22, y - size * 0.22);
    ctx.fillText(text[3], x - size * 0.22, y + size * 0.22);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

// 中文避头尾折行（与版式计算共用 wrapText）
function wrapChineseText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  return wrapText((t) => ctx.measureText(t).width, text, maxWidth);
}

// 辅助函数：将正在编辑的文本临时替换到页面数据中以实现即时渲染
export function applyTextOverride(
  page: PageContent,
  activeElementId: string,
  text: string
): PageContent {
  const p = { ...page };
  if (activeElementId === 'title') {
    p.title = text;
  } else if (activeElementId === 'subtitle') {
    p.subtitle = text;
  } else if (activeElementId === 'author') {
    p.author = text;
  } else if (activeElementId === 'chapterNumber') {
    p.chapterNumber = text;
  } else if (activeElementId === 'header') {
    p.headerText = text;
  } else if (activeElementId === 'seal') {
    p.sealText = text;
  } else if (activeElementId.startsWith('paragraph-')) {
    const idx = parseInt(activeElementId.replace('paragraph-', ''), 10);
    if (p.paragraphs && !isNaN(idx) && idx >= 0 && idx < p.paragraphs.length) {
      p.paragraphs = [...p.paragraphs];
      p.paragraphs[idx] = text;
    }
  } else if (activeElementId.startsWith('poetry-')) {
    const idx = parseInt(activeElementId.replace('poetry-', ''), 10);
    if (p.poetryLines && !isNaN(idx) && idx >= 0 && idx < p.poetryLines.length) {
      p.poetryLines = [...p.poetryLines];
      p.poetryLines[idx] = text;
    }
  } else if (activeElementId.startsWith('note-')) {
    const idx = parseInt(activeElementId.replace('note-', ''), 10);
    if (p.notes && !isNaN(idx) && idx >= 0 && idx < p.notes.length) {
      p.notes = [...p.notes];
      p.notes[idx] = text;
    }
  } else if (activeElementId.startsWith('toc-')) {
    const idx = parseInt(activeElementId.replace('toc-', ''), 10);
    if (p.tocItems && !isNaN(idx) && idx >= 0 && idx < p.tocItems.length) {
      p.tocItems = [...p.tocItems];
      p.tocItems[idx] = { ...p.tocItems[idx], title: text };
    }
  } else if (activeElementId.startsWith('colophon-')) {
    const idx = parseInt(activeElementId.replace('colophon-', ''), 10);
    if (p.colophonDetails && !isNaN(idx) && idx >= 0 && idx < p.colophonDetails.length) {
      p.colophonDetails = [...p.colophonDetails];
      p.colophonDetails[idx] = { ...p.colophonDetails[idx], value: text };
    }
  }
  return p;
}

// 绘制出版级典雅裁切规线 ┌ ┐ └ ┘
function drawCropMarks(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  color = '#9B2D26'
) {
  const { x, y, width, height } = bounds;
  const len = 16;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'square';

  // 左上角 ┌
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.stroke();

  // 右上角 ┐
  ctx.beginPath();
  ctx.moveTo(x + width - len, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + len);
  ctx.stroke();

  // 左下角 └
  ctx.beginPath();
  ctx.moveTo(x, y + height - len);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + len, y + height);
  ctx.stroke();

  // 右下角 ┘
  ctx.beginPath();
  ctx.moveTo(x + width - len, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - len);
  ctx.stroke();
  ctx.restore();
}

// 绘制激活聚焦选框与标签
function drawActiveBox(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  accentColor = '#9B2D26'
) {
  const { x, y, width, height } = bounds;
  ctx.save();
  ctx.fillStyle = 'rgba(155, 45, 38, 0.04)';
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  const len = 12;
  ctx.lineWidth = 3;
  ctx.beginPath();
  // 左上
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  // 右上
  ctx.moveTo(x + width - len, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + len);
  // 左下
  ctx.moveTo(x, y + height - len);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + len, y + height);
  // 右下
  ctx.moveTo(x + width - len, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - len);
  ctx.stroke();

  ctx.font = `bold 16px ${WENKAI_FONT}`;
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('· 墨入纸面 ·', x + width - 4, y - 6);
  ctx.restore();
}

// 融合选区：外圆角 + 行间内倒角，半透明渐变填充、细描边与柔光
export function paintSelection(
  ctx: CanvasRenderingContext2D,
  style: TextStyle,
  rects: Rect[],
  accent: string
) {
  if (rects.length === 0) return;
  const segs = buildSelectionShape(rects, {
    cornerRadius: style.fontSize * 0.32,
    filletRadius: style.fontSize * 0.4,
    padX: Math.max(2, style.fontSize * 0.1),
  });
  if (segs.length === 0) return;

  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  const left = Math.min(...rects.map((r) => r.x));
  const right = Math.max(...rects.map((r) => r.x + r.width));

  ctx.save();
  ctx.beginPath();
  traceSegments(ctx, segs);

  const grad = ctx.createLinearGradient(left, top, right, bottom);
  grad.addColorStop(0, rgba(accent, 0.34));
  grad.addColorStop(1, rgba(accent, 0.2));
  ctx.shadowColor = rgba(accent, 0.55);
  ctx.shadowBlur = 16;
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(accent, 0.7);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

// 绘制原生打字光标 | 与选区高亮：几何完全来自版式样式，保证与文字对位
export function paintEditOverlay(
  ctx: CanvasRenderingContext2D,
  page: PageContent,
  customOptions: RenderOptions,
  editState: PageEditState
) {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  const elements = getCachedLayoutElements(page, Math.max(0, page.sideIndex - 1));

  if (editState.hoveredElementId && editState.hoveredElementId !== editState.activeElementId) {
    const el = elements.find((e) => e.id === editState.hoveredElementId);
    if (el) drawCropMarks(ctx, el.bounds, options.accentColor);
  }

  if (!editState.activeElementId) return;
  const el = elements.find((e) => e.id === editState.activeElementId);
  if (!el) return;
  drawActiveBox(ctx, el.bounds, options.accentColor);
  if (el.type === 'seal') return;

  const start = editState.selectionStart ?? el.text.length;
  const end = editState.selectionEnd ?? start;

  if (start !== end) {
    paintSelection(ctx, el.style, selectionRects(el.style, el.text, start, end), options.accentColor);
  } else if (editState.caretVisible) {
    const g = caretGeometry(el.style, el.text, start);
    ctx.save();
    ctx.strokeStyle = options.accentColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (g.horizontal) {
      ctx.moveTo(g.x - g.height / 2, g.top);
      ctx.lineTo(g.x + g.height / 2, g.top);
    } else {
      ctx.moveTo(g.x, g.top);
      ctx.lineTo(g.x, g.top + g.height);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** 纸面底图（不含编辑覆盖层）；纸纹噪点按页确定性生成，重绘不闪烁 */
export function renderPageBase(
  page: PageContent,
  customOptions?: RenderOptions
): HTMLCanvasElement {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // 1. 纸张底色与微杂质质感
  ctx.fillStyle = options.paperColor;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 极微弱的纸张噪点纤维底纹
  ctx.fillStyle = 'rgba(0, 0, 0, 0.012)';
  let seed = (page.sideIndex * 2654435761) >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < 400; i++) {
    const rx = rand() * CANVAS_WIDTH;
    const ry = rand() * CANVAS_HEIGHT;
    const rw = rand() * 2 + 1;
    ctx.fillRect(rx, ry, rw, rw);
  }

  // 整页图片：直接以图片作为页面内容（图片未就绪时保留纸面底色）
  if (page.imageUrl) {
    const image = getCachedPageImage(page.imageUrl);
    if (image) drawPageImage(ctx, image, page.imageFit);
    return canvas;
  }

  const isLeftPage = page.sideIndex % 2 === 0;
  // 订口在书脊处：左页书脊在右侧，右页书脊在左侧
  const spineMargin = 150;
  const outerMargin = 160;
  const contentLeft = isLeftPage ? outerMargin : spineMargin;
  const contentRight = isLeftPage ? CANVAS_WIDTH - spineMargin : CANVAS_WIDTH - outerMargin;
  const contentWidth = contentRight - contentLeft;

  // 2. 封面特别渲染
  if (page.type === 'cover') {
    renderCover(ctx, page, options);
    return canvas;
  }

  // 3. 封底版权页特别渲染
  if (page.type === 'colophon') {
    renderColophon(ctx, page, options);
    return canvas;
  }

  // 4. 标准书眉（Running Header）
  ctx.save();
  ctx.strokeStyle = 'rgba(36, 34, 32, 0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(contentLeft, 140);
  ctx.lineTo(contentRight, 140);
  ctx.stroke();

  ctx.font = `400 24px ${WENKAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
  ctx.textBaseline = 'bottom';
  if (hasText(page.headerText)) {
    if (isLeftPage) {
      ctx.textAlign = 'left';
      ctx.fillText(page.headerText, contentLeft, 130);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(page.headerText, contentRight, 130);
    }
  }
  ctx.restore();

  // 5. 页码（Folio）
  ctx.save();
  ctx.font = `500 24px ${WENKAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.5)';
  ctx.textBaseline = 'top';
  const pageNumStr = `— ${page.sideIndex.toString().padStart(2, '0')} —`;
  if (isLeftPage) {
    ctx.textAlign = 'left';
    ctx.fillText(pageNumStr, contentLeft, CANVAS_HEIGHT - 120);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText(pageNumStr, contentRight, CANVAS_HEIGHT - 120);
  }
  ctx.restore();

  // 6. 根据版式渲染正文内容
  let startY = 240;

  if (page.type === 'frontispiece') {
    // 扉页
    startY = 420;
    ctx.fillStyle = options.textColor;
    ctx.font = `bold 54px ${WENKAI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(page.title, CANVAS_WIDTH / 2, startY);

    if (hasText(page.subtitle)) {
      startY += 70;
      ctx.font = `400 28px ${WENKAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.65)';
      ctx.fillText(page.subtitle, CANVAS_WIDTH / 2, startY);
    }

    startY += 120;
    ctx.fillStyle = options.textColor;
    ctx.font = `400 32px ${WENKAI_FONT}`;
    ctx.textAlign = 'left';

    const pWidth = 840;
    const pLeft = (CANVAS_WIDTH - pWidth) / 2;
    const fpCount = page.paragraphs?.length ?? 0;
    page.paragraphs?.forEach((p, idx) => {
      startY = drawFigures(ctx, page, idx, pLeft, pWidth, startY);
      const lines = wrapChineseText(ctx, '　　' + p, pWidth);
      for (const line of lines) {
        ctx.fillText(line, pLeft, startY);
        startY += 58;
      }
      startY += 28;
    });
    startY = drawFigures(ctx, page, fpCount, pLeft, pWidth, startY);

    if (hasText(page.sealText)) {
      drawSeal(ctx, page.sealText, CANVAS_WIDTH / 2, startY + 60, 68, options.accentColor);
    }
  } else if (page.type === 'toc') {
    // 目录
    startY = 240;
    ctx.fillStyle = options.textColor;
    ctx.font = `bold 56px ${WENKAI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(page.title, CANVAS_WIDTH / 2, startY);

    if (hasText(page.subtitle)) {
      startY += 50;
      ctx.font = `500 22px ${WENKAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.5)';
      ctx.fillText(page.subtitle, CANVAS_WIDTH / 2, startY);
    }

    // 目录分割线
    startY += 60;
    ctx.strokeStyle = options.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2 - 80, startY);
    ctx.lineTo(CANVAS_WIDTH / 2 + 80, startY);
    ctx.stroke();

    startY += 80;
    if (page.tocItems) {
      for (const item of page.tocItems) {
        ctx.font = `500 32px ${WENKAI_FONT}`;
        ctx.fillStyle = options.textColor;
        ctx.textAlign = 'left';
        ctx.fillText(item.title, contentLeft, startY);

        ctx.font = `400 24px ${WENKAI_FONT}`;
        ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
        const authorX = contentLeft + 480;
        ctx.fillText(item.author, authorX, startY);

        ctx.font = `bold 28px ${WENKAI_FONT}`;
        ctx.fillStyle = options.textColor;
        ctx.textAlign = 'right';
        ctx.fillText(item.page, contentRight, startY);

        // 点划引导线
        ctx.fillStyle = 'rgba(36, 34, 32, 0.25)';
        ctx.font = `400 24px ${WENKAI_FONT}`;
        ctx.textAlign = 'left';
        const dotsLeft = authorX + 160;
        const dotsRight = contentRight - 60;
        let dotX = dotsLeft;
        while (dotX < dotsRight) {
          ctx.fillText('·', dotX, startY - 2);
          dotX += 16;
        }

        startY += 84;
      }
    }
  } else if (page.type === 'chapter') {
    // 章节扉页
    startY = 480;
    if (hasText(page.chapterNumber)) {
      ctx.font = `bold 32px ${WENKAI_FONT}`;
      ctx.fillStyle = options.accentColor;
      ctx.textAlign = 'center';
      ctx.fillText(page.chapterNumber, CANVAS_WIDTH / 2, startY);
      startY += 60;
    }

    ctx.font = `bold 64px ${WENKAI_FONT}`;
    ctx.fillStyle = options.textColor;
    ctx.textAlign = 'center';
    ctx.fillText(page.title, CANVAS_WIDTH / 2, startY);

    if (hasText(page.subtitle)) {
      startY += 64;
      ctx.font = `400 28px ${WENKAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
      ctx.fillText(page.subtitle, CANVAS_WIDTH / 2, startY);
    }

    if (hasText(page.author)) {
      startY += 54;
      ctx.font = `500 30px ${WENKAI_FONT}`;
      ctx.fillStyle = options.textColor;
      ctx.fillText(page.author, CANVAS_WIDTH / 2, startY);
    }

    startY += 120;
    const descWidth = 780;
    const descLeft = (CANVAS_WIDTH - descWidth) / 2;
    ctx.font = `400 30px ${WENKAI_FONT}`;
    ctx.fillStyle = 'rgba(36, 34, 32, 0.8)';
    ctx.textAlign = 'left';
    const dpCount = page.paragraphs?.length ?? 0;
    page.paragraphs?.forEach((p, idx) => {
      startY = drawFigures(ctx, page, idx, descLeft, descWidth, startY);
      const lines = wrapChineseText(ctx, '　　' + p, descWidth);
      for (const line of lines) {
        ctx.fillText(line, descLeft, startY);
        startY += 56;
      }
    });
    startY = drawFigures(ctx, page, dpCount, descLeft, descWidth, startY);

    if (hasText(page.sealText)) {
      drawSeal(ctx, page.sealText, CANVAS_WIDTH / 2, startY + 80, 72, options.accentColor);
    }
  } else if (page.type === 'poetry') {
    // 诗歌排版（优美居中呼吸感）
    startY = 260;
    ctx.font = `bold 48px ${WENKAI_FONT}`;
    ctx.fillStyle = options.textColor;
    ctx.textAlign = 'center';
    ctx.fillText(page.title, CANVAS_WIDTH / 2, startY);

    if (hasText(page.subtitle)) {
      startY += 48;
      ctx.font = `400 26px ${WENKAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
      ctx.fillText(page.subtitle, CANVAS_WIDTH / 2, startY);
    }

    if (hasText(page.author)) {
      startY += 46;
      ctx.font = `400 28px ${WENKAI_FONT}`;
      ctx.fillStyle = options.textColor;
      ctx.fillText(page.author, CANVAS_WIDTH / 2, startY);
    }

    startY += 80;
    ctx.font = `400 32px ${WENKAI_FONT}`;
    ctx.fillStyle = options.textColor;
    ctx.textAlign = 'center';

    if (page.poetryLines) {
      for (const line of page.poetryLines) {
        if (line === '') {
          startY += 36;
        } else {
          ctx.fillText(line, CANVAS_WIDTH / 2, startY);
          startY += 56;
        }
      }
    }
  } else {
    // 标准图书正文散文页（经典出版物排法）
    startY = 220;
    if (hasText(page.title)) {
      ctx.font = `bold 40px ${WENKAI_FONT}`;
      ctx.fillStyle = options.textColor;
      ctx.textAlign = 'left';
      ctx.fillText(page.title, contentLeft, startY);
      startY += 70;
    }

    // 正文
    ctx.font = `400 31px ${WENKAI_FONT}`;
    ctx.fillStyle = options.textColor;
    ctx.textAlign = 'left';

    const lineHeight = 60;
    const ppCount = page.paragraphs?.length ?? 0;
    page.paragraphs?.forEach((p, idx) => {
      startY = drawFigures(ctx, page, idx, contentLeft, contentWidth, startY);
      const lines = wrapChineseText(ctx, '　　' + p, contentWidth);
      for (const line of lines) {
        ctx.fillText(line, contentLeft, startY);
        startY += lineHeight;
      }
      startY += 26; // 段落间距
    });
    startY = drawFigures(ctx, page, ppCount, contentLeft, contentWidth, startY);

    // 脚注（如果有）
    if (page.notes && page.notes.length > 0) {
      const noteY = CANVAS_HEIGHT - 320;
      ctx.strokeStyle = 'rgba(36, 34, 32, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(contentLeft, noteY);
      ctx.lineTo(contentLeft + 240, noteY);
      ctx.stroke();

      ctx.font = `400 24px ${WENKAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.65)';
      let ny = noteY + 36;
      for (const n of page.notes) {
        ctx.fillText(n, contentLeft, ny);
        ny += 38;
      }
    }
  }

  return canvas;
}

export function renderPageToCanvas(
  page: PageContent,
  customOptions?: RenderOptions,
  editState?: PageEditState
): HTMLCanvasElement {
  const canvas = renderPageBase(page, customOptions);
  if (editState) {
    paintEditOverlay(canvas.getContext('2d')!, page, customOptions ?? {}, editState);
  }
  return canvas;
}

// 封面特别绘制
function renderCover(
  ctx: CanvasRenderingContext2D,
  page: PageContent,
  options: Required<RenderOptions>
) {
  // 古籍中式书衣装帧
  ctx.fillStyle = '#F5F2EB';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 封套外框线
  ctx.strokeStyle = 'rgba(155, 45, 38, 0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, CANVAS_WIDTH - 120, CANVAS_HEIGHT - 120);

  ctx.strokeStyle = 'rgba(155, 45, 38, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(72, 72, CANVAS_WIDTH - 144, CANVAS_HEIGHT - 144);

  // 中式书签题签框（靠右偏上，传统线装书题签）
  const labelX = CANVAS_WIDTH * 0.68;
  const labelY = 220;
  const labelW = 160;
  const labelH = 820;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(labelX, labelY, labelW, labelH);
  ctx.strokeStyle = options.accentColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(labelX, labelY, labelW, labelH);

  // 题签内细框
  ctx.lineWidth = 1;
  ctx.strokeRect(labelX + 8, labelY + 8, labelW - 16, labelH - 16);

  // 竖排大字书名
  ctx.fillStyle = '#1D1A18';
  ctx.font = `bold 68px ${WENKAI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const titleChars = (page.title || '').split('').slice(0, 8);
  let ty = labelY + 60;
  for (const ch of titleChars) {
    ctx.fillText(ch, labelX + labelW / 2, ty);
    ty += 92;
  }

  // 题签下方作者
  ctx.font = `500 26px ${WENKAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.7)';
  ctx.fillText('文心选本', labelX + labelW / 2, labelY + labelH - 80);

  // 封面副标题（横排于左侧）
  ctx.textAlign = 'left';
  ctx.font = `500 34px ${WENKAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.85)';
  const subX = 220;
  let subY = 680;
  if (hasText(page.subtitle)) {
    ctx.fillText(page.subtitle, subX, subY);
    subY += 60;
  }

  ctx.font = `400 28px ${WENKAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
  if (hasText(page.author)) {
    ctx.fillText(page.author, subX, subY);
  }

  // 印章
  drawSeal(ctx, page.sealText || '文心典藏', subX + 46, subY + 120, 84, options.accentColor);

  // 底部出版社
  ctx.font = `bold 28px ${WENKAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('文 心 出 版 局', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 160);
}

// 版权页绘制
function renderColophon(
  ctx: CanvasRenderingContext2D,
  page: PageContent,
  options: Required<RenderOptions>
) {
  const boxW = 860;
  const boxH = 920;
  const boxX = (CANVAS_WIDTH - boxW) / 2;
  const boxY = (CANVAS_HEIGHT - boxH) / 2;

  ctx.strokeStyle = 'rgba(36, 34, 32, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // 标题
  ctx.font = `bold 42px ${WENKAI_FONT}`;
  ctx.fillStyle = options.textColor;
  ctx.textAlign = 'center';
  ctx.fillText(page.title || '图书在版编目（ＣＩＰ）数据', CANVAS_WIDTH / 2, boxY + 80);

  ctx.strokeStyle = 'rgba(36, 34, 32, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(boxX + 60, boxY + 120);
  ctx.lineTo(boxX + boxW - 60, boxY + 120);
  ctx.stroke();

  let cy = boxY + 190;
  ctx.font = `400 28px ${WENKAI_FONT}`;
  ctx.textAlign = 'left';

  if (page.colophonDetails) {
    for (const item of page.colophonDetails) {
      ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
      ctx.fillText(item.key + '：', boxX + 80, cy);

      ctx.fillStyle = options.textColor;
      ctx.fillText(item.value, boxX + 280, cy);
      cy += 54;
    }
  }

  // 底部出版印章与条形码意象
  drawSeal(ctx, page.sealText || '文心出版', CANVAS_WIDTH / 2, boxY + boxH - 120, 72, options.accentColor);

  ctx.font = `400 22px ${WENKAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('ISBN 978-7-5000-0000-0 · 定价：48.00元', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 160);
}

/**
 * 将整本书的所有页面渲染为 Three.js CanvasTexture 数组
 */
