export const WENKAI_FONT =
  '"LXGW WenKai", "LXGW WenKai Mono", "KaiTi", "STKaiti", "Noto Serif SC", "Songti SC", "STSong", serif';

export type TextAlign = 'left' | 'center' | 'right';

/** 描述一个文本块在页面纹理上的绘制方式；布局、渲染、光标拾取共用这一份数据 */
export interface TextStyle {
  fontSize: number;
  weight: number | 'bold';
  align: TextAlign;
  /** 对齐锚点的 x（left=左边缘, center=中心, right=右边缘） */
  anchorX: number;
  /** 首行的 y：alphabetic 基线，或 baseline==='top' 时的文字顶部 */
  baselineY: number;
  baseline: 'alphabetic' | 'top';
  lineHeight: number;
  /** 折行宽度；缺省为单行 */
  maxWidth?: number;
  /** 首行缩进等不可编辑前缀 */
  prefix?: string;
  /** 竖排逐字绘制（封面题签），step 为字距 */
  vertical?: { step: number };
}

export const hasText = (v: unknown): v is string => typeof v === 'string';

export const fontOf = (s: Pick<TextStyle, 'weight' | 'fontSize'>) =>
  `${s.weight} ${s.fontSize}px ${WENKAI_FONT}`;

export type Measure = (s: string) => number;

let measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    try {
      measureCtx =
        typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      measureCtx = null;
    }
  }
  return measureCtx;
}

/** 字体加载完成后版式缓存需要失效 */
let fontEpochValue = 0;
export const getFontEpoch = () => fontEpochValue;
if (typeof document !== 'undefined' && document.fonts?.addEventListener) {
  document.fonts.addEventListener('loadingdone', () => {
    fontEpochValue++;
  });
}

export function makeMeasure(style: Pick<TextStyle, 'weight' | 'fontSize'>): Measure {
  const ctx = getMeasureCtx();
  const font = fontOf(style);
  if (!ctx) {
    // 无 Canvas 环境（测试）：CJK 全宽，其余半宽估算
    return (s) => {
      let w = 0;
      for (const ch of s) w += ch.charCodeAt(0) > 0xff ? style.fontSize : style.fontSize * 0.55;
      return w;
    };
  }
  return (s) => {
    ctx.font = font;
    return ctx.measureText(s).width;
  };
}

const NO_START = '，。！？；：）》”、’』】';

/** 中文避头尾折行 */
export function wrapText(measure: Measure, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    if (char === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    const test = current + char;
    if (measure(test) > maxWidth && current.length > 0) {
      if (NO_START.includes(char)) {
        lines.push(test);
        current = '';
        continue;
      }
      lines.push(current);
      current = char;
    } else {
      current = test;
    }
  }
  if (current.length > 0 || lines.length === 0) lines.push(current);
  return lines;
}

export function textLines(style: TextStyle, text: string, measure = makeMeasure(style)) {
  const full = (style.prefix ?? '') + text;
  const lines = style.maxWidth ? wrapText(measure, full, style.maxWidth) : [full];
  return { lines, measure };
}

export function lineTop(style: TextStyle, lineIdx: number): number {
  const first = style.baseline === 'top' ? style.baselineY : style.baselineY - style.fontSize * 0.85;
  return first + lineIdx * style.lineHeight;
}

function lineLeft(style: TextStyle, width: number): number {
  if (style.align === 'center') return style.anchorX - width / 2;
  if (style.align === 'right') return style.anchorX - width;
  return style.anchorX;
}

export interface CaretGeometry {
  x: number;
  top: number;
  height: number;
  /** 竖排时光标画成横线 */
  horizontal?: boolean;
}

export function caretGeometry(style: TextStyle, text: string, index: number): CaretGeometry {
  const idx0 = Math.max(0, Math.min(index, text.length));
  if (style.vertical) {
    return {
      x: style.anchorX,
      top: style.baselineY + idx0 * style.vertical.step,
      height: style.fontSize,
      horizontal: true,
    };
  }
  const { lines, measure } = textLines(style, text);
  const idx = idx0 + (style.prefix?.length ?? 0);
  let acc = 0;
  let li = 0;
  for (; li < lines.length; li++) {
    if (idx < acc + lines[li].length || li === lines.length - 1) break;
    acc += lines[li].length;
  }
  const line = lines[li];
  const local = Math.min(Math.max(idx - acc, 0), line.length);
  return {
    x: lineLeft(style, measure(line)) + measure(line.slice(0, local)),
    top: lineTop(style, li),
    height: style.fontSize * 1.05,
  };
}

/** 画布坐标 → 文本字符下标（点击定位光标） */
export function indexAtPoint(style: TextStyle, text: string, x: number, y: number): number {
  if (style.vertical) {
    const n = Math.round((y - style.baselineY - style.fontSize / 2) / style.vertical.step) + 1;
    return Math.max(0, Math.min(text.length, n));
  }
  const { lines, measure } = textLines(style, text);
  const rel = (y - (lineTop(style, 0) - (style.lineHeight - style.fontSize * 1.05) / 2)) / style.lineHeight;
  const li = Math.max(0, Math.min(lines.length - 1, Math.floor(rel)));
  const line = lines[li];
  const local = x - lineLeft(style, measure(line));
  let j = 0;
  let prev = 0;
  for (; j < line.length; j++) {
    const next = measure(line.slice(0, j + 1));
    if (local < (prev + next) / 2) break;
    prev = next;
  }
  let acc = 0;
  for (let k = 0; k < li; k++) acc += lines[k].length;
  return Math.max(0, Math.min(text.length, acc + j - (style.prefix?.length ?? 0)));
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function selectionRects(style: TextStyle, text: string, from: number, to: number): Rect[] {
  if (style.vertical || from === to) return [];
  const a = Math.min(from, to) + (style.prefix?.length ?? 0);
  const b = Math.max(from, to) + (style.prefix?.length ?? 0);
  const { lines, measure } = textLines(style, text);
  const rects: Rect[] = [];
  let acc = 0;
  lines.forEach((line, li) => {
    const s = Math.max(a, acc);
    const e = Math.min(b, acc + line.length);
    if (e > s) {
      const left = lineLeft(style, measure(line));
      const x0 = left + measure(line.slice(0, s - acc));
      const x1 = left + measure(line.slice(0, e - acc));
      rects.push({ x: x0, y: lineTop(style, li), width: x1 - x0, height: style.fontSize * 1.05 });
    }
    acc += line.length;
  });
  return rects;
}

/** 上/下移一行并保持 x，返回新下标；越界返回 null */
export function moveCaretVertically(
  style: TextStyle,
  text: string,
  index: number,
  dir: -1 | 1
): number | null {
  if (style.vertical) return null;
  const { lines } = textLines(style, text);
  const g = caretGeometry(style, text, index);
  const li = Math.round((g.top - lineTop(style, 0)) / style.lineHeight);
  const target = li + dir;
  if (target < 0 || target >= lines.length) return null;
  return indexAtPoint(style, text, g.x, lineTop(style, target) + style.fontSize * 0.5);
}
