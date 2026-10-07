import * as THREE from 'three';
import { PageContent } from './chinesePublicationData';

const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 1983; // 1440 * 1.37708

const SERIF_FONT = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif';
const KAI_FONT = '"KaiTi", "STKaiti", "Noto Serif SC", serif';

export interface RenderOptions {
  paperColor?: string;
  textColor?: string;
  accentColor?: string;
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
  ctx.font = `bold ${Math.round(size * 0.38)}px ${SERIF_FONT}`;
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

// 中文避头尾折行算法
function wrapChineseText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const noStartPunct = '，。！？；：）》”、’』】';
  const noEndPunct = '（《“‘『【';

  let currentLine = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const testLine = currentLine + char;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine.length > 0) {
      // 检查当前字符是否不能放在行首
      if (noStartPunct.includes(char)) {
        // 将上一行的最后一个字符拉到本行或者强行塞入
        currentLine += char;
        lines.push(currentLine);
        currentLine = '';
        continue;
      }
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines;
}

export function renderPageToCanvas(
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
  for (let i = 0; i < 400; i++) {
    const rx = Math.random() * CANVAS_WIDTH;
    const ry = Math.random() * CANVAS_HEIGHT;
    const rw = Math.random() * 2 + 1;
    ctx.fillRect(rx, ry, rw, rw);
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

  ctx.font = `400 24px ${SERIF_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
  ctx.textBaseline = 'bottom';
  if (page.headerText) {
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
  ctx.font = `500 24px ${SERIF_FONT}`;
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
    ctx.font = `bold 54px ${SERIF_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(page.title, CANVAS_WIDTH / 2, startY);

    if (page.subtitle) {
      startY += 70;
      ctx.font = `400 28px ${KAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.65)';
      ctx.fillText(page.subtitle, CANVAS_WIDTH / 2, startY);
    }

    startY += 120;
    ctx.fillStyle = options.textColor;
    ctx.font = `400 32px ${KAI_FONT}`;
    ctx.textAlign = 'left';

    const pWidth = 840;
    const pLeft = (CANVAS_WIDTH - pWidth) / 2;
    if (page.paragraphs) {
      for (const p of page.paragraphs) {
        const lines = wrapChineseText(ctx, '　　' + p, pWidth);
        for (const line of lines) {
          ctx.fillText(line, pLeft, startY);
          startY += 58;
        }
        startY += 28;
      }
    }

    if (page.sealText) {
      drawSeal(ctx, page.sealText, CANVAS_WIDTH / 2, startY + 60, 68, options.accentColor);
    }
  } else if (page.type === 'toc') {
    // 目录
    startY = 240;
    ctx.fillStyle = options.textColor;
    ctx.font = `bold 56px ${SERIF_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(page.title, CANVAS_WIDTH / 2, startY);

    if (page.subtitle) {
      startY += 50;
      ctx.font = `500 22px ${SERIF_FONT}`;
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
        ctx.font = `500 32px ${SERIF_FONT}`;
        ctx.fillStyle = options.textColor;
        ctx.textAlign = 'left';
        ctx.fillText(item.title, contentLeft, startY);

        ctx.font = `400 24px ${KAI_FONT}`;
        ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
        const authorX = contentLeft + 480;
        ctx.fillText(item.author, authorX, startY);

        ctx.font = `bold 28px ${SERIF_FONT}`;
        ctx.fillStyle = options.textColor;
        ctx.textAlign = 'right';
        ctx.fillText(item.page, contentRight, startY);

        // 点划引导线
        ctx.fillStyle = 'rgba(36, 34, 32, 0.25)';
        ctx.font = `400 24px ${SERIF_FONT}`;
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
    if (page.chapterNumber) {
      ctx.font = `bold 32px ${SERIF_FONT}`;
      ctx.fillStyle = options.accentColor;
      ctx.textAlign = 'center';
      ctx.fillText(page.chapterNumber, CANVAS_WIDTH / 2, startY);
      startY += 60;
    }

    ctx.font = `bold 64px ${SERIF_FONT}`;
    ctx.fillStyle = options.textColor;
    ctx.textAlign = 'center';
    ctx.fillText(page.title, CANVAS_WIDTH / 2, startY);

    if (page.subtitle) {
      startY += 64;
      ctx.font = `400 28px ${KAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
      ctx.fillText(page.subtitle, CANVAS_WIDTH / 2, startY);
    }

    if (page.author) {
      startY += 54;
      ctx.font = `500 30px ${SERIF_FONT}`;
      ctx.fillStyle = options.textColor;
      ctx.fillText(page.author, CANVAS_WIDTH / 2, startY);
    }

    startY += 120;
    const descWidth = 780;
    const descLeft = (CANVAS_WIDTH - descWidth) / 2;
    ctx.font = `400 30px ${KAI_FONT}`;
    ctx.fillStyle = 'rgba(36, 34, 32, 0.8)';
    ctx.textAlign = 'left';
    if (page.paragraphs) {
      for (const p of page.paragraphs) {
        const lines = wrapChineseText(ctx, '　　' + p, descWidth);
        for (const line of lines) {
          ctx.fillText(line, descLeft, startY);
          startY += 56;
        }
      }
    }

    if (page.sealText) {
      drawSeal(ctx, page.sealText, CANVAS_WIDTH / 2, startY + 80, 72, options.accentColor);
    }
  } else if (page.type === 'poetry') {
    // 诗歌排版（优美居中呼吸感）
    startY = 260;
    ctx.font = `bold 48px ${SERIF_FONT}`;
    ctx.fillStyle = options.textColor;
    ctx.textAlign = 'center';
    ctx.fillText(page.title, CANVAS_WIDTH / 2, startY);

    if (page.subtitle) {
      startY += 48;
      ctx.font = `400 26px ${KAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
      ctx.fillText(page.subtitle, CANVAS_WIDTH / 2, startY);
    }

    if (page.author) {
      startY += 46;
      ctx.font = `400 28px ${SERIF_FONT}`;
      ctx.fillStyle = options.textColor;
      ctx.fillText(page.author, CANVAS_WIDTH / 2, startY);
    }

    startY += 80;
    ctx.font = `400 32px ${SERIF_FONT}`;
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
    if (page.title) {
      ctx.font = `bold 40px ${SERIF_FONT}`;
      ctx.fillStyle = options.textColor;
      ctx.textAlign = 'left';
      ctx.fillText(page.title, contentLeft, startY);
      startY += 70;
    }

    // 正文
    ctx.font = `400 31px ${SERIF_FONT}`;
    ctx.fillStyle = options.textColor;
    ctx.textAlign = 'left';

    const lineHeight = 60;
    if (page.paragraphs) {
      for (const p of page.paragraphs) {
        const lines = wrapChineseText(ctx, '　　' + p, contentWidth);
        for (const line of lines) {
          ctx.fillText(line, contentLeft, startY);
          startY += lineHeight;
        }
        startY += 26; // 段落间距
      }
    }

    // 脚注（如果有）
    if (page.notes && page.notes.length > 0) {
      const noteY = CANVAS_HEIGHT - 320;
      ctx.strokeStyle = 'rgba(36, 34, 32, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(contentLeft, noteY);
      ctx.lineTo(contentLeft + 240, noteY);
      ctx.stroke();

      ctx.font = `400 24px ${KAI_FONT}`;
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
  ctx.font = `bold 68px ${SERIF_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const titleChars = page.title.split('');
  let ty = labelY + 60;
  for (const ch of titleChars) {
    ctx.fillText(ch, labelX + labelW / 2, ty);
    ty += 92;
  }

  // 题签下方作者
  ctx.font = `500 26px ${KAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.7)';
  ctx.fillText('文心选本', labelX + labelW / 2, labelY + labelH - 80);

  // 封面副标题（横排于左侧）
  ctx.textAlign = 'left';
  ctx.font = `500 34px ${SERIF_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.85)';
  const subX = 220;
  let subY = 680;
  if (page.subtitle) {
    ctx.fillText(page.subtitle, subX, subY);
    subY += 60;
  }

  ctx.font = `400 28px ${KAI_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
  if (page.author) {
    ctx.fillText(page.author, subX, subY);
  }

  // 印章
  drawSeal(ctx, page.sealText || '文心典藏', subX + 46, subY + 120, 84, options.accentColor);

  // 底部出版社
  ctx.font = `bold 28px ${SERIF_FONT}`;
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
  ctx.font = `bold 42px ${SERIF_FONT}`;
  ctx.fillStyle = options.textColor;
  ctx.textAlign = 'center';
  ctx.fillText('图书在版编目（ＣＩＰ）数据', CANVAS_WIDTH / 2, boxY + 80);

  ctx.strokeStyle = 'rgba(36, 34, 32, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(boxX + 60, boxY + 120);
  ctx.lineTo(boxX + boxW - 60, boxY + 120);
  ctx.stroke();

  let cy = boxY + 190;
  ctx.font = `400 28px ${SERIF_FONT}`;
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

  ctx.font = `400 22px ${SERIF_FONT}`;
  ctx.fillStyle = 'rgba(36, 34, 32, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('ISBN 978-7-5000-0000-0 · 定价：48.00元', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 160);
}

/**
 * 将整本书的所有页面渲染为 Three.js CanvasTexture 数组
 */
export function createBookTextures(
  pages: PageContent[],
  options?: RenderOptions
): THREE.CanvasTexture[] {
  return pages.map((page) => {
    const canvas = renderPageToCanvas(page, options);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  });
}
