/** 屏幕空间 Canvas UI 的布局与命中检测（纯函数，绘制见 screenLayer.ts） */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Viewport {
  w: number;
  h: number;
}

export const inBox = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

const MARGIN = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------- 右键菜单 ----------

export type IconName = 'highlight' | 'underline' | 'wave' | 'strike' | 'swatch';

export interface RowButton {
  id: string;
  title: string;
  icon: IconName;
  color?: string;
  active?: boolean;
}

export type MenuEntry =
  | { kind: 'item'; id: string; label: string; hint?: string; disabled?: boolean }
  | { kind: 'sep' }
  | { kind: 'row'; label: string; buttons: RowButton[] };

export interface LaidEntry {
  entry: MenuEntry;
  box: Box;
  buttons?: { button: RowButton; box: Box }[];
}

export interface MenuLayout {
  box: Box;
  entries: LaidEntry[];
}

export const MENU = { width: 232, item: 34, sep: 9, row: 44, pad: 6, btn: 30, gap: 6, labelW: 56 };

export function layoutMenu(entries: MenuEntry[], at: { x: number; y: number }, vp: Viewport): MenuLayout {
  const heights = entries.map((e) => (e.kind === 'item' ? MENU.item : e.kind === 'sep' ? MENU.sep : MENU.row));
  const h = heights.reduce((a, b) => a + b, 0) + MENU.pad * 2;
  const w = MENU.width;
  const x = clamp(at.x + w + MARGIN > vp.w ? at.x - w : at.x, MARGIN, Math.max(MARGIN, vp.w - w - MARGIN));
  const y = clamp(at.y + h + MARGIN > vp.h ? at.y - h : at.y, MARGIN, Math.max(MARGIN, vp.h - h - MARGIN));
  let cy = y + MENU.pad;
  const laid: LaidEntry[] = entries.map((entry, i) => {
    const box = { x, y: cy, w, h: heights[i] };
    cy += heights[i];
    if (entry.kind !== 'row') return { entry, box };
    let bx = x + MENU.pad + MENU.labelW + 8;
    const by = box.y + (box.h - MENU.btn) / 2;
    const buttons = entry.buttons.map((button) => {
      const b = { button, box: { x: bx, y: by, w: MENU.btn, h: MENU.btn } };
      bx += MENU.btn + MENU.gap;
      return b;
    });
    return { entry, box, buttons };
  });
  return { box: { x, y, w, h }, entries: laid };
}

export interface MenuHit {
  id: string;
  /** 行内按钮还是整行菜单项 */
  kind: 'item' | 'button';
}

export function hitMenu(layout: MenuLayout, x: number, y: number): MenuHit | null {
  if (!inBox(layout.box, x, y)) return null;
  for (const l of layout.entries) {
    if (l.entry.kind === 'item' && !l.entry.disabled && inBox(l.box, x, y)) return { id: l.entry.id, kind: 'item' };
    for (const b of l.buttons ?? []) if (inBox(b.box, x, y)) return { id: b.button.id, kind: 'button' };
  }
  return null;
}

// ---------- 查找栏 ----------

export interface FindBarLayout {
  box: Box;
  input: Box;
  prev: Box;
  next: Box;
  close: Box;
}

export function layoutFindBar(vp: Viewport): FindBarLayout {
  const w = Math.min(420, vp.w - 2 * MARGIN);
  const h = 46;
  const x = (vp.w - w) / 2;
  const y = 14;
  const s = 30;
  const close = { x: x + w - s - 8, y: y + 8, w: s, h: s };
  const next = { x: close.x - s - 2, y: y + 8, w: s, h: s };
  const prev = { x: next.x - s - 2, y: y + 8, w: s, h: s };
  return { box: { x, y, w, h }, input: { x: x + 14, y: y + 6, w: prev.x - x - 90, h: h - 12 }, prev, next, close };
}

// ---------- 笔记编辑框 ----------

export interface NoteLayout {
  box: Box;
  text: Box;
  save: Box;
  cancel: Box;
}

export function layoutNote(at: { x: number; y: number }, vp: Viewport): NoteLayout {
  const w = 320;
  const h = 168;
  const x = clamp(at.x - w / 2, MARGIN, Math.max(MARGIN, vp.w - w - MARGIN));
  const y = clamp(at.y + 12, MARGIN, Math.max(MARGIN, vp.h - h - MARGIN));
  return {
    box: { x, y, w, h },
    text: { x: x + 14, y: y + 40, w: w - 28, h: h - 92 },
    save: { x: x + w - 14 - 64, y: y + h - 44, w: 64, h: 30 },
    cancel: { x: x + w - 14 - 64 - 8 - 64, y: y + h - 44, w: 64, h: 30 },
  };
}

// ---------- 标注 / 书签侧栏 ----------

export const PANEL = { header: 48, entry: 64 };

export interface PanelLayout {
  box: Box;
  close: Box;
  list: Box;
}

export function layoutPanel(vp: Viewport): PanelLayout {
  const w = Math.min(320, vp.w - 2 * MARGIN);
  const box = { x: vp.w - w - 12, y: 12, w, h: Math.max(120, vp.h - 24) };
  return {
    box,
    close: { x: box.x + box.w - 38, y: box.y + 9, w: 30, h: 30 },
    list: { x: box.x, y: box.y + PANEL.header, w, h: box.h - PANEL.header },
  };
}

export const panelContentHeight = (count: number) => count * PANEL.entry;
export const clampPanelScroll = (scroll: number, count: number, listH: number) =>
  clamp(scroll, 0, Math.max(0, panelContentHeight(count) - listH));

export function hitPanel(layout: PanelLayout, scroll: number, count: number, x: number, y: number): number | 'close' | null {
  if (inBox(layout.close, x, y)) return 'close';
  if (!inBox(layout.list, x, y)) return null;
  const i = Math.floor((y - layout.list.y + scroll) / PANEL.entry);
  return i >= 0 && i < count ? i : null;
}
