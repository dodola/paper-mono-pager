import type { PageContent } from './chinesePublicationData';
import { figureAdvance, figureRect, figuresAt, captionBaseline } from './figureFlow';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './pageLayout';
import { WENKAI_FONT, hasText } from './textMetrics';

export type ImageFit = 'cover' | 'contain';

export interface FitBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 把 imgW×imgH 的图片放进 boxW×boxH 的页面：cover 铺满并裁切，contain 完整显示并留白 */
export function fitRect(imgW: number, imgH: number, boxW: number, boxH: number, fit: ImageFit): FitBox {
  if (!(imgW > 0 && imgH > 0)) return { x: 0, y: 0, width: boxW, height: boxH };
  const scale = fit === 'cover' ? Math.max(boxW / imgW, boxH / imgH) : Math.min(boxW / imgW, boxH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height };
}

type Entry = { status: 'loading'; promise: Promise<HTMLImageElement | null> } | { status: 'ready'; image: HTMLImageElement } | { status: 'failed' };

const cache = new Map<string, Entry>();

/** 已加载完成的图片；未加载或失败返回 null（渲染器据此回退为纸面底色） */
export function getCachedPageImage(url: string): HTMLImageElement | null {
  const hit = cache.get(url);
  return hit?.status === 'ready' ? hit.image : null;
}

/**
 * 加载页面图片并缓存。
 * 图片会被绘入 Canvas 再上传为 WebGL 纹理，因此必须以 CORS 方式请求（crossOrigin=anonymous），
 * 否则跨域图片会污染画布，纹理上传直接报 SecurityError；跨域图床需返回 Access-Control-Allow-Origin。
 */
export function loadPageImage(url: string): Promise<HTMLImageElement | null> {
  const hit = cache.get(url);
  if (hit?.status === 'ready') return Promise.resolve(hit.image);
  if (hit?.status === 'loading') return hit.promise;
  if (hit?.status === 'failed') return Promise.resolve(null);

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      cache.set(url, { status: 'ready', image });
      resolve(image);
    };
    image.onerror = () => {
      console.warn(`Page image failed to load: ${url}`);
      cache.set(url, { status: 'failed' });
      resolve(null);
    };
    image.src = url;
  });
  cache.set(url, { status: 'loading', promise });
  return promise;
}

/** 将图片按 fit 方式绘入整张页面画布 */
export function drawPageImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, fit: ImageFit = 'cover') {
  const r = fitRect(image.naturalWidth, image.naturalHeight, CANVAS_WIDTH, CANVAS_HEIGHT, fit);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, r.x, r.y, r.width, r.height);
}

/**
 * 绘制正文流 slot 处的插图（含图注），返回推进后的基线 y。
 * 图片未就绪时先画浅色占位块，保证版面不跳动。
 */
export function drawFigures(
  ctx: CanvasRenderingContext2D,
  page: PageContent,
  slot: number,
  x: number,
  width: number,
  y: number
): number {
  for (const f of figuresAt(page, slot)) {
    const rect = figureRect(f, x, width, y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    const image = getCachedPageImage(f.url);
    if (image) {
      const r = fitRect(image.naturalWidth, image.naturalHeight, rect.width, rect.height, f.fit ?? 'cover');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, rect.x + r.x, rect.y + r.y, r.width, r.height);
    } else {
      ctx.fillStyle = 'rgba(36, 34, 32, 0.05)';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    ctx.restore();

    if (hasText(f.caption)) {
      ctx.save();
      ctx.font = `400 24px ${WENKAI_FONT}`;
      ctx.fillStyle = 'rgba(36, 34, 32, 0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(f.caption, rect.x + rect.width / 2, captionBaseline(rect));
      ctx.restore();
    }
    y += figureAdvance(f);
  }
  return y;
}
