import { WENKAI_FONT, wrapText } from '../textMetrics';
import {
  Box,
  FindBarLayout,
  IconName,
  MENU,
  MenuLayout,
  NoteLayout,
  PANEL,
  PanelLayout,
  Viewport,
} from './canvasUi';

export interface Theme {
  paper: string;
  ink: string;
  accent: string;
}

export interface PanelItem {
  kind: 'bookmark' | 'annotation';
  title: string;
  sub: string;
  color?: string;
  pageIndex: number;
}

export interface ScreenState {
  menu?: { layout: MenuLayout; hover: string | null };
  find?: { layout: FindBarLayout; query: string; caret: number; label: string; hover: string | null };
  note?: { layout: NoteLayout; text: string; caret: number; hover: string | null };
  panel?: { layout: PanelLayout; scroll: number; items: PanelItem[]; hover: number | 'close' | null };
  tooltip?: { text: string; x: number; y: number };
  toast?: { text: string; alpha: number };
}

const font = (px: number, weight: number | string = 400) => `${weight} ${px}px ${WENKAI_FONT}`;

function rr(ctx: CanvasRenderingContext2D, b: Box, r: number) {
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, r);
}

function card(ctx: CanvasRenderingContext2D, b: Box, t: Theme, r = 12) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = t.paper;
  rr(ctx, b, r);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 1;
  rr(ctx, b, r);
  ctx.stroke();
  ctx.restore();
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: IconName, b: Box, color: string | undefined, t: Theme) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.save();
  if (icon === 'swatch') {
    ctx.fillStyle = color ?? t.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const c = color ?? '#F2C94C';
  if (icon === 'highlight') {
    ctx.fillStyle = c + '99';
    ctx.beginPath();
    ctx.roundRect(cx - 10, cy - 9, 20, 18, 4);
    ctx.fill();
  }
  ctx.fillStyle = t.ink;
  ctx.font = font(15, 600);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('文', cx, cy - 1);
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (icon === 'underline') {
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 11);
    ctx.lineTo(cx + 9, cy + 11);
    ctx.stroke();
  } else if (icon === 'wave') {
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 11);
    for (let i = 0; i < 6; i++) ctx.lineTo(cx - 9 + (i + 1) * 3, cy + 11 + (i % 2 === 0 ? -2 : 2));
    ctx.stroke();
  } else if (icon === 'strike') {
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMenu(ctx: CanvasRenderingContext2D, m: { layout: MenuLayout; hover: string | null }, t: Theme) {
  card(ctx, m.layout.box, t, 10);
  for (const l of m.layout.entries) {
    const e = l.entry;
    if (e.kind === 'sep') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(l.box.x + 12, l.box.y + l.box.h / 2, l.box.w - 24, 1);
    } else if (e.kind === 'item') {
      if (m.hover === e.id && !e.disabled) {
        ctx.fillStyle = t.accent + '22';
        rr(ctx, { x: l.box.x + 4, y: l.box.y + 2, w: l.box.w - 8, h: l.box.h - 4 }, 6);
        ctx.fill();
      }
      ctx.fillStyle = e.disabled ? 'rgba(0,0,0,0.3)' : t.ink;
      ctx.font = font(14.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, l.box.x + 16, l.box.y + l.box.h / 2);
      if (e.hint) {
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.font = font(12);
        ctx.textAlign = 'right';
        ctx.fillText(e.hint, l.box.x + l.box.w - 14, l.box.y + l.box.h / 2);
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = font(13);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, l.box.x + MENU.pad + 10, l.box.y + l.box.h / 2);
      for (const { button, box } of l.buttons ?? []) {
        if (button.active || m.hover === button.id) {
          ctx.fillStyle = button.active ? t.accent + '30' : 'rgba(0,0,0,0.07)';
          rr(ctx, box, 7);
          ctx.fill();
        }
        if (button.active) {
          ctx.strokeStyle = t.accent;
          ctx.lineWidth = 1.5;
          rr(ctx, box, 7);
          ctx.stroke();
        }
        drawIcon(ctx, button.icon, box, button.color, t);
      }
    }
  }
}

function button(ctx: CanvasRenderingContext2D, b: Box, label: string, t: Theme, primary: boolean, hover: boolean) {
  ctx.fillStyle = primary ? (hover ? t.accent : t.accent + 'dd') : hover ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)';
  rr(ctx, b, 7);
  ctx.fill();
  ctx.fillStyle = primary ? '#fff' : t.ink;
  ctx.font = font(13.5, 500);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
}

function chevron(ctx: CanvasRenderingContext2D, b: Box, dir: -1 | 1 | 0, t: Theme, hover: boolean) {
  if (hover) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    rr(ctx, b, 7);
    ctx.fill();
  }
  ctx.strokeStyle = t.ink;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.beginPath();
  if (dir === 0) {
    ctx.moveTo(cx - 5, cy - 5);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.moveTo(cx + 5, cy - 5);
    ctx.lineTo(cx - 5, cy + 5);
  } else {
    ctx.moveTo(cx - 5, cy + dir * -2.5);
    ctx.lineTo(cx, cy + dir * 2.5);
    ctx.lineTo(cx + 5, cy + dir * -2.5);
  }
  ctx.stroke();
}

function drawFind(ctx: CanvasRenderingContext2D, f: NonNullable<ScreenState['find']>, t: Theme) {
  const L = f.layout;
  card(ctx, L.box, t, 23);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = font(15);
  const cy = L.box.y + L.box.h / 2;
  ctx.fillStyle = f.query ? t.ink : 'rgba(0,0,0,0.35)';
  ctx.fillText(f.query || '在全书中查找…', L.input.x, cy);
  if (f.query || true) {
    const cx = L.input.x + ctx.measureText(f.query.slice(0, f.caret)).width;
    ctx.fillStyle = t.accent;
    ctx.fillRect(cx + 1, cy - 9, 1.5, 18);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = font(12.5);
  ctx.textAlign = 'right';
  ctx.fillText(f.label, L.prev.x - 6, cy);
  chevron(ctx, L.prev, -1, t, f.hover === 'prev');
  chevron(ctx, L.next, 1, t, f.hover === 'next');
  chevron(ctx, L.close, 0, t, f.hover === 'close');
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines = 99
): { lines: string[]; lastW: number } {
  const lines = wrapText((s) => ctx.measureText(s).width, text, maxW).slice(0, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return { lines, lastW: ctx.measureText(lines[lines.length - 1] ?? '').width };
}

function drawNote(ctx: CanvasRenderingContext2D, n: NonNullable<ScreenState['note']>, t: Theme) {
  const L = n.layout;
  card(ctx, L.box, t, 12);
  ctx.fillStyle = t.accent;
  ctx.font = font(14, 600);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('笔记', L.box.x + 14, L.box.y + 20);
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  rr(ctx, L.text, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.text.x, L.text.y, L.text.w, L.text.h);
  ctx.clip();
  ctx.font = font(15);
  ctx.textBaseline = 'top';
  ctx.fillStyle = n.text ? t.ink : 'rgba(0,0,0,0.35)';
  const { lines, lastW } = drawWrapped(ctx, n.text || '写下此刻的想法…', L.text.x + 10, L.text.y + 8, L.text.w - 20, 22);
  if (n.text) {
    ctx.fillStyle = t.accent;
    ctx.fillRect(L.text.x + 10 + lastW + 1, L.text.y + 8 + (lines.length - 1) * 22 + 2, 1.5, 17);
  }
  ctx.restore();
  button(ctx, L.cancel, '取消', t, false, n.hover === 'cancel');
  button(ctx, L.save, '保存', t, true, n.hover === 'save');
}

function drawPanel(ctx: CanvasRenderingContext2D, p: NonNullable<ScreenState['panel']>, t: Theme) {
  const L = p.layout;
  card(ctx, L.box, t, 14);
  ctx.fillStyle = t.ink;
  ctx.font = font(16, 600);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('标注与书签', L.box.x + 18, L.box.y + PANEL.header / 2);
  chevron(ctx, L.close, 0, t, p.hover === 'close');
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(L.box.x, L.box.y + PANEL.header - 1, L.box.w, 1);

  ctx.save();
  ctx.beginPath();
  ctx.rect(L.list.x, L.list.y, L.list.w, L.list.h);
  ctx.clip();
  if (p.items.length === 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = font(14);
    ctx.textAlign = 'center';
    ctx.fillText('还没有标注或书签', L.list.x + L.list.w / 2, L.list.y + 50);
  }
  p.items.forEach((it, i) => {
    const y = L.list.y + i * PANEL.entry - p.scroll;
    if (y + PANEL.entry < L.list.y || y > L.list.y + L.list.h) return;
    if (p.hover === i) {
      ctx.fillStyle = t.accent + '16';
      ctx.fillRect(L.list.x, y, L.list.w, PANEL.entry);
    }
    ctx.fillStyle = it.kind === 'bookmark' ? t.accent : it.color ?? t.accent;
    ctx.fillRect(L.list.x + 16, y + 12, 4, PANEL.entry - 24);
    ctx.fillStyle = t.ink;
    ctx.font = font(14.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const title = ellipsis(ctx, it.title, L.list.w - 48);
    ctx.fillText(title, L.list.x + 30, y + 27);
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.font = font(12);
    ctx.fillText(ellipsis(ctx, it.sub, L.list.w - 48), L.list.x + 30, y + 47);
  });
  ctx.restore();
}

function ellipsis(ctx: CanvasRenderingContext2D, s: string, maxW: number) {
  if (ctx.measureText(s).width <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + '…';
}

function drawTooltip(ctx: CanvasRenderingContext2D, tip: NonNullable<ScreenState['tooltip']>, t: Theme, vp: Viewport) {
  ctx.font = font(13.5);
  const lines = wrapText((s) => ctx.measureText(s).width, tip.text, 240).slice(0, 8);
  const w = Math.min(264, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24);
  const h = lines.length * 20 + 18;
  const x = Math.max(8, Math.min(tip.x + 12, vp.w - w - 8));
  const y = Math.max(8, Math.min(tip.y + 18, vp.h - h - 8));
  card(ctx, { x, y, w, h }, t, 8);
  ctx.fillStyle = t.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + 12, y + 9 + i * 20));
}

function drawToast(ctx: CanvasRenderingContext2D, toast: NonNullable<ScreenState['toast']>, vp: Viewport) {
  ctx.save();
  ctx.globalAlpha = toast.alpha;
  ctx.font = font(14);
  const w = ctx.measureText(toast.text).width + 36;
  const b = { x: (vp.w - w) / 2, y: vp.h - 86, w, h: 36 };
  ctx.fillStyle = 'rgba(36,34,32,0.88)';
  rr(ctx, b, 18);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(toast.text, b.x + w / 2, b.y + b.h / 2);
  ctx.restore();
}

/** 盖在 3D 画布上的屏幕空间 2D 画布：菜单、查找栏、笔记框、侧栏等全部在此绘制，自身不接收指针事件 */
export class ScreenLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;
  private vp: Viewport = { w: 0, h: 0 };
  private dpr = 1;
  onResize?: () => void;

  constructor(private container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.dataset.readerScreenLayer = '';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:30;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ro = new ResizeObserver(() => {
      this.measure();
      this.onResize?.();
    });
    this.ro.observe(container);
    this.measure();
  }

  viewport(): Viewport {
    return this.vp;
  }

  private measure() {
    const r = this.container.getBoundingClientRect();
    this.vp = { w: r.width, h: r.height };
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  }

  draw(state: ScreenState, theme: Theme) {
    const { ctx, dpr, vp } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vp.w, vp.h);
    if (state.panel) drawPanel(ctx, state.panel, theme);
    if (state.find) drawFind(ctx, state.find, theme);
    if (state.menu) drawMenu(ctx, state.menu, theme);
    if (state.note) drawNote(ctx, state.note, theme);
    if (state.tooltip) drawTooltip(ctx, state.tooltip, theme, vp);
    if (state.toast) drawToast(ctx, state.toast, vp);
  }

  dispose() {
    this.ro.disconnect();
    this.canvas.remove();
  }
}
