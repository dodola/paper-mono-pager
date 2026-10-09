import type { PageContent, PageFigure } from './chinesePublicationData';
import { hasText } from './textMetrics';

/** 图文混排的纵向步进。版式计算与渲染器共用，保证编辑光标/选区与绘制严格对齐 */

export const FIGURE_DEFAULT_HEIGHT = 480;
/** 图注占用的行高 */
const CAPTION_ROW = 44;
/** 图片上下留白合计（图上沿比下一行基线高 TOP_OFFSET，其余留在图下） */
const FIGURE_GAP = 56;
const TOP_OFFSET = 28;

export const figureHeight = (f: PageFigure) => f.height ?? FIGURE_DEFAULT_HEIGHT;

/** 该图片在正文流中占用的纵向高度（含图注与留白） */
export function figureAdvance(f: PageFigure): number {
  return figureHeight(f) + (hasText(f.caption) ? CAPTION_ROW : 0) + FIGURE_GAP;
}

/** 图片落在第几段之前（0 = 第一段前，段数 = 全部正文之后），越界收敛到合法范围 */
function slotOf(f: PageFigure, paragraphCount: number): number {
  return Math.min(Math.max(f.beforeParagraph ?? paragraphCount, 0), paragraphCount);
}

/** 位于 slot 处的图片，保持数组中的先后顺序 */
export function figuresAt(page: PageContent, slot: number): PageFigure[] {
  const n = page.paragraphs?.length ?? 0;
  return (page.figures ?? []).filter((f) => slotOf(f, n) === slot);
}

/** slot 处所有图片占用的总高度 */
export function figureSpan(page: PageContent, slot: number): number {
  return figuresAt(page, slot).reduce((sum, f) => sum + figureAdvance(f), 0);
}

/** 图片矩形：当前流位置为下一行基线 baselineY，图上沿与该行文字上沿齐平 */
export function figureRect(f: PageFigure, x: number, width: number, baselineY: number) {
  return { x, y: baselineY - TOP_OFFSET, width, height: figureHeight(f) };
}

/** 图注基线（图片下方） */
export const captionBaseline = (rect: { y: number; height: number }) => rect.y + rect.height + 32;

/** 页面用到的全部图片地址（整页图 + 插图），用于异步预载 */
export function pageImageUrls(page: PageContent): string[] {
  return [...(page.imageUrl ? [page.imageUrl] : []), ...(page.figures ?? []).map((f) => f.url)];
}
