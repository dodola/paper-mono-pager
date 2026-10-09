/** 阅读态指针手势仲裁：这次按下归阅读器（选字）还是引擎（翻页）。纯函数，便于测试。 */

export interface PointerContext {
  /** 编辑模式、翻页动画中等不接管 */
  enabled: boolean;
  button: number;
  /** 按下点所在页面的画布 x，及左/右页 */
  side: 'left' | 'right';
  canvasX: number;
  canvasWidth: number;
  /** 按下点是否落在文字上 */
  onText: boolean;
  /** 是否落在已有标注上 */
  onAnnotation: boolean;
}

export type Claim = 'reader' | 'engine';

/** 书页外侧边缘保留给拖拽翻页的比例 */
export const FLIP_EDGE_RATIO = 0.06;

export function arbitrate(c: PointerContext): Claim {
  if (!c.enabled) return 'engine';
  if (c.button === 2) return 'reader';
  if (c.button !== 0) return 'engine';
  const edge = c.canvasWidth * FLIP_EDGE_RATIO;
  const inFlipEdge = c.side === 'right' ? c.canvasX > c.canvasWidth - edge : c.canvasX < edge;
  if (inFlipEdge) return 'engine';
  return c.onText || c.onAnnotation ? 'reader' : 'engine';
}

export type ClickKind = 'single' | 'double' | 'triple';

/** 连击计数：同位置、间隔短则累加 */
export function nextClickCount(
  prev: { time: number; x: number; y: number; count: number } | null,
  now: { time: number; x: number; y: number },
  windowMs = 450,
  slopPx = 6
): number {
  if (!prev) return 1;
  const near = Math.hypot(now.x - prev.x, now.y - prev.y) <= slopPx;
  if (near && now.time - prev.time <= windowMs) return Math.min(prev.count + 1, 3);
  return 1;
}
