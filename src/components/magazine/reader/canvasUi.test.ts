import { describe, it, expect } from 'vitest';
import { layoutMenu, hitMenu, MenuEntry, layoutPanel, hitPanel, clampPanelScroll, inBox } from './canvasUi';

const entries: MenuEntry[] = [
  { kind: 'item', id: 'copy', label: '复制' },
  { kind: 'sep' },
  { kind: 'row', label: '划线', buttons: [{ id: 'style:wave', title: '波浪', icon: 'wave' }] },
  { kind: 'item', id: 'off', label: '禁用', disabled: true },
];
const vp = { w: 800, h: 600 };

describe('menu layout', () => {
  it('stays inside the viewport near the bottom-right corner', () => {
    const l = layoutMenu(entries, { x: 790, y: 590 }, vp);
    expect(l.box.x).toBeGreaterThanOrEqual(0);
    expect(l.box.y).toBeGreaterThanOrEqual(0);
    expect(l.box.x + l.box.w).toBeLessThanOrEqual(vp.w);
    expect(l.box.y + l.box.h).toBeLessThanOrEqual(vp.h);
  });
  it('opens at the pointer when there is room', () => {
    const l = layoutMenu(entries, { x: 100, y: 100 }, vp);
    expect(l.box.x).toBe(100);
    expect(l.box.y).toBe(100);
  });
  it('hit tests items and row buttons but not disabled ones or separators', () => {
    const l = layoutMenu(entries, { x: 100, y: 100 }, vp);
    const [copy, sep, row, off] = l.entries;
    expect(hitMenu(l, copy.box.x + 10, copy.box.y + 5)).toEqual({ id: 'copy', kind: 'item' });
    expect(hitMenu(l, sep.box.x + 10, sep.box.y + 4)).toBeNull();
    const b = row.buttons![0].box;
    expect(hitMenu(l, b.x + 2, b.y + 2)).toEqual({ id: 'style:wave', kind: 'button' });
    expect(hitMenu(l, off.box.x + 10, off.box.y + 5)).toBeNull();
    expect(hitMenu(l, 5, 5)).toBeNull();
  });
});

describe('panel', () => {
  it('maps clicks to entries accounting for scroll and handles close', () => {
    const p = layoutPanel(vp);
    expect(hitPanel(p, 0, 5, p.list.x + 5, p.list.y + 10)).toBe(0);
    expect(hitPanel(p, 64, 5, p.list.x + 5, p.list.y + 10)).toBe(1);
    expect(hitPanel(p, 0, 1, p.list.x + 5, p.list.y + 200)).toBeNull();
    expect(inBox(p.close, p.close.x + 1, p.close.y + 1)).toBe(true);
    expect(hitPanel(p, 0, 3, p.close.x + 1, p.close.y + 1)).toBe('close');
  });
  it('clamps scroll to content', () => {
    expect(clampPanelScroll(999, 3, 500)).toBe(0);
    expect(clampPanelScroll(999, 20, 500)).toBe(20 * 64 - 500);
    expect(clampPanelScroll(-5, 20, 500)).toBe(0);
  });
});
