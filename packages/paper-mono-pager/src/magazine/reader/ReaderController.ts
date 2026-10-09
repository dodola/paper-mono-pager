import { PageContent } from '../chinesePublicationData';
import { CANVAS_WIDTH } from '../pageLayout';
import type { ReaderEngineHost } from './engineHost';
import {
  ANNOTATION_COLORS,
  Annotation,
  AnnotationType,
  ReaderState,
  ResolvedAnnotation,
  createAnnotations,
  newId,
  removeGroup,
  resolveAnnotations,
  setGroupNote,
  updateGroup,
} from './annotations';
import { MenuEntry, RowButton, hitMenu, hitPanel, inBox, layoutFindBar, layoutMenu, layoutNote, layoutPanel, clampPanelScroll } from './canvasUi';
import type { MenuLayout } from './canvasUi';
import { arbitrate, nextClickCount } from './gesture';
import type { ReaderPageOverlay } from './overlayPainter';
import {
  Pos,
  Run,
  buildRuns,
  comparePos,
  findRun,
  paragraphRange,
  posAtPoint,
  segmentsOf,
  textOf,
  wordRange,
} from './readerDoc';
import { Match, findMatches, firstMatchFrom } from './search';
import { PanelItem, ScreenLayer, ScreenState, Theme } from './screenLayer';
import { ReaderServices, defaultServices } from './services';

export interface ReaderControllerOptions {
  engine: ReaderEngineHost;
  getPages: () => PageContent[];
  getTheme: () => Theme;
  /** 缺省使用浏览器实现；可逐项替换为宿主自己的库 */
  services?: Partial<ReaderServices>;
}

type MenuCtx =
  | { kind: 'selection' }
  | { kind: 'annotation'; groupId: string }
  | { kind: 'page'; pageIndex: number };

const STYLE_BUTTONS: { type: AnnotationType; title: string }[] = [
  { type: 'highlight', title: '荧光笔' },
  { type: 'underline', title: '直线' },
  { type: 'wave', title: '波浪线' },
  { type: 'strike', title: '删除线' },
];

const isTextInput = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

export class ReaderController {
  private engine: ReaderEngineHost;
  private getPages: () => PageContent[];
  private getTheme: () => Theme;
  private services: ReaderServices;
  private screen: ScreenLayer;
  private proxy: HTMLTextAreaElement;
  private abort = new AbortController();

  private enabled = true;
  private pages: PageContent[] = [];
  private allRuns: Run[] = [];
  private resolvedCache: ResolvedAnnotation[] | null = null;

  private annotations: Annotation[] = [];
  private bookmarks = new Set<number>();
  private color: string = ANNOTATION_COLORS[0];

  private sel: { anchor: Pos; focus: Pos } | null = null;
  private down: {
    x: number;
    y: number;
    moved: boolean;
    count: number;
    ann: ResolvedAnnotation | null;
    unit: 'char' | 'word' | 'para';
    origin: { from: Pos; to: Pos } | null;
    suppressClick: boolean;
  } | null = null;
  private lastClick: { time: number; x: number; y: number; count: number } | null = null;

  private menu: { layout: MenuLayout; hover: string | null; ctx: MenuCtx; at: { x: number; y: number } } | null = null;
  private note: { groupId: string; text: string; caret: number; at: { x: number; y: number }; hover: string | null } | null = null;
  private find: { query: string; caret: number; matches: Match[]; index: number; hover: string | null } | null = null;
  private panel: { scroll: number; hover: number | 'close' | null } | null = null;
  private tooltip: { text: string; x: number; y: number } | null = null;
  private toastState: { text: string; until: number } | null = null;

  private lastOverlay = new Map<number, string>();
  private raf = 0;

  constructor(opts: ReaderControllerOptions) {
    this.engine = opts.engine;
    this.getPages = opts.getPages;
    this.getTheme = opts.getTheme;
    this.services = { ...defaultServices(), ...opts.services };
    const container = this.engine.getContainer();
    this.screen = new ScreenLayer(container);
    this.screen.onResize = () => this.refresh();
    this.proxy = this.createProxy(container);

    this.setPages(this.getPages());
    Promise.resolve(this.services.store.load()).then((s) => {
      this.annotations = s.annotations;
      this.bookmarks = new Set(s.bookmarks);
      this.resolvedCache = null;
      this.refresh();
    });

    this.engine.setPointerInterceptor((e) => this.onStagePointerDown(e));
    const sig = { signal: this.abort.signal };
    window.addEventListener('pointerdown', this.onWindowPointerDown, { capture: true, signal: this.abort.signal });
    window.addEventListener('pointermove', this.onPointerMove, sig);
    window.addEventListener('pointerup', this.onPointerUp, sig);
    window.addEventListener('pointercancel', this.onPointerUp, sig);
    window.addEventListener('keydown', this.onKeyDown, { capture: true, signal: this.abort.signal });
    window.addEventListener('wheel', this.onWheel, { passive: false, signal: this.abort.signal });
    container.addEventListener('contextmenu', this.onContextMenu, { capture: true, signal: this.abort.signal });
  }

  // ---------- 对外接口 ----------

  setEnabled(on: boolean) {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) this.resetTransient();
    this.lastOverlay.clear();
    this.refresh();
  }

  setPages(pages: PageContent[]) {
    this.pages = pages;
    this.allRuns = buildRuns(
      pages,
      pages.map((_, i) => i)
    );
    this.resolvedCache = null;
    if (this.sel) this.sel = null;
    if (this.find) this.runSearch();
    this.refresh();
  }

  /** 翻页后：旧页的选区、菜单、悬浮提示都失效 */
  onPageChange() {
    this.down = null;
    this.sel = null;
    this.menu = null;
    this.tooltip = null;
    this.refresh();
  }

  exportState(): ReaderState {
    return { annotations: this.annotations, bookmarks: [...this.bookmarks].sort((a, b) => a - b) };
  }

  importState(state: ReaderState) {
    this.annotations = state.annotations;
    this.bookmarks = new Set(state.bookmarks);
    this.resolvedCache = null;
    this.persist();
    this.refresh();
  }

  openFind() {
    const prefill = this.selectedText();
    this.find = { query: prefill || this.find?.query || '', caret: 0, matches: [], index: -1, hover: null };
    this.find.caret = this.find.query.length;
    this.runSearch(true);
    this.focusProxy(this.find.query);
  }

  togglePanel() {
    this.panel = this.panel ? null : { scroll: 0, hover: null };
    this.refresh();
  }

  async copySelection() {
    const text = this.selectedText();
    if (!text) return false;
    const ok = await this.services.clipboard.writeText(text);
    this.toast(ok ? '已复制' : '复制失败，请检查浏览器权限');
    return ok;
  }

  dispose() {
    this.abort.abort();
    cancelAnimationFrame(this.raf);
    this.engine.setPointerInterceptor(null);
    this.engine.getHitArea().style.cursor = 'pointer';
    for (const p of this.lastOverlay.keys()) this.engine.setPageReaderOverlay(p, null);
    this.proxy.remove();
    this.screen.dispose();
  }

  // ---------- 状态辅助 ----------

  private resetTransient() {
    this.down = null;
    this.sel = null;
    this.menu = null;
    this.note = null;
    this.tooltip = null;
    this.proxy.blur();
  }

  private visiblePages(): number[] {
    return [this.engine.getLeftPageIndex(), this.engine.getRightPageIndex()].filter((n): n is number => n !== null);
  }

  private visibleRuns(): Run[] {
    const v = new Set(this.visiblePages());
    return this.allRuns.filter((r) => v.has(r.pageIndex));
  }

  private currentPage(): number {
    return this.engine.getRightPageIndex() ?? this.engine.getLeftPageIndex() ?? 0;
  }

  private resolved(): ResolvedAnnotation[] {
    return (this.resolvedCache ??= resolveAnnotations(this.annotations, this.allRuns));
  }

  private hasSelection() {
    return !!this.sel && comparePos(this.allRuns, this.sel.anchor, this.sel.focus) !== 0;
  }

  private selectedText() {
    return this.sel && this.hasSelection() ? textOf(this.allRuns, this.sel.anchor, this.sel.focus) : '';
  }

  private annotationAt(p: Pos): ResolvedAnnotation | null {
    const hits = this.resolved().filter(
      (a) => a.pageIndex === p.pageIndex && a.elementId === p.elementId && p.offset >= a.from && p.offset < a.to
    );
    return hits[hits.length - 1] ?? null;
  }

  private local(e: { clientX: number; clientY: number }) {
    const r = this.engine.getContainer().getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private persist() {
    void this.services.store.save(this.exportState());
  }

  private toast(text: string) {
    this.toastState = { text, until: performance.now() + 1600 };
    this.refresh();
  }

  private clearSelection() {
    if (this.sel || this.menu) {
      this.sel = null;
      this.menu = null;
      this.refresh();
    }
  }

  private goToPage(pageIndex: number) {
    if (!this.visiblePages().includes(pageIndex)) this.engine.goToPage(pageIndex);
  }

  // ---------- 指针 ----------

  private onStagePointerDown = (e: PointerEvent): boolean => {
    if (!this.enabled || this.engine.isEditing()) return false;
    const coords = this.engine.getCanvasCoordsFromClient(e.clientX, e.clientY);
    if (!coords) return false;
    const runs = this.visibleRuns();
    const hit = posAtPoint(runs, coords.pageIndex, coords.canvasX, coords.canvasY, false);
    const ann = hit ? this.annotationAt(hit) : null;
    const claim = arbitrate({
      enabled: true,
      button: e.button,
      side: coords.side,
      canvasX: coords.canvasX,
      canvasWidth: CANVAS_WIDTH,
      onText: !!hit,
      onAnnotation: !!ann,
    });
    if (claim === 'engine') {
      this.clearSelection();
      return false;
    }
    if (e.button !== 0 || !hit) return true;

    const count = nextClickCount(this.lastClick, { time: e.timeStamp, x: e.clientX, y: e.clientY });
    this.lastClick = { time: e.timeStamp, x: e.clientX, y: e.clientY, count };
    const run = findRun(runs, hit.pageIndex, hit.elementId)!;
    let unit: 'char' | 'word' | 'para' = 'char';
    let origin: { from: Pos; to: Pos } | null = null;

    if (count === 1) {
      if (e.shiftKey && this.sel) this.sel = { anchor: this.sel.anchor, focus: hit };
      else this.sel = { anchor: hit, focus: hit };
    } else {
      const r = count === 2 ? wordRange(run.text, hit.offset) : paragraphRange(run.text);
      unit = count === 2 ? 'word' : 'para';
      origin = { from: { ...hit, offset: r.from }, to: { ...hit, offset: r.to } };
      this.sel = { anchor: origin.from, focus: origin.to };
    }
    this.menu = null;
    this.down = { x: e.clientX, y: e.clientY, moved: false, count, ann, unit, origin, suppressClick: false };
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* 捕获失败不影响选字 */
    }
    this.refresh();
    return true;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.enabled || this.engine.isEditing()) return;
    const p = this.local(e);

    if (this.down) {
      if (!this.down.moved && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 4) this.down.moved = true;
      if (this.down.moved || this.down.unit !== 'char') this.dragTo(e);
      return;
    }

    let changed = false;
    if (this.note) {
      const L = layoutNote(this.note.at, this.screen.viewport());
      const h = inBox(L.save, p.x, p.y) ? 'save' : inBox(L.cancel, p.x, p.y) ? 'cancel' : null;
      if (h !== this.note.hover) ((this.note.hover = h), (changed = true));
    }
    if (this.menu) {
      const h = hitMenu(this.menu.layout, p.x, p.y)?.id ?? null;
      if (h !== this.menu.hover) ((this.menu.hover = h), (changed = true));
    }
    if (this.find) {
      const L = layoutFindBar(this.screen.viewport());
      const h = inBox(L.prev, p.x, p.y) ? 'prev' : inBox(L.next, p.x, p.y) ? 'next' : inBox(L.close, p.x, p.y) ? 'close' : null;
      if (h !== this.find.hover) ((this.find.hover = h), (changed = true));
    }
    if (this.panel) {
      const L = layoutPanel(this.screen.viewport());
      const h = hitPanel(L, this.panel.scroll, this.panelItems().length, p.x, p.y);
      if (h !== this.panel.hover) ((this.panel.hover = h), (changed = true));
    }

    const overUi = this.pointOnUi(p.x, p.y);
    const hitArea = this.engine.getHitArea();
    let tip: ReaderController['tooltip'] = null;
    if (overUi) {
      hitArea.style.cursor = 'default';
    } else {
      const coords = this.engine.getCanvasCoordsFromClient(e.clientX, e.clientY);
      const hit = coords ? posAtPoint(this.visibleRuns(), coords.pageIndex, coords.canvasX, coords.canvasY, false) : null;
      const ann = hit ? this.annotationAt(hit) : null;
      hitArea.style.cursor = hit ? (ann ? 'pointer' : 'text') : 'pointer';
      if (ann?.note) tip = { text: ann.note, x: p.x, y: p.y };
    }
    if (tip?.text !== this.tooltip?.text || (tip && this.tooltip && (tip.x !== this.tooltip.x || tip.y !== this.tooltip.y))) {
      this.tooltip = tip;
      changed = true;
    }
    if (changed) this.refresh();
  };

  private dragTo(e: PointerEvent) {
    if (!this.down || !this.sel) return;
    const coords = this.engine.getCanvasCoordsFromClient(e.clientX, e.clientY);
    if (!coords) return;
    const pos = posAtPoint(this.visibleRuns(), coords.pageIndex, coords.canvasX, coords.canvasY, true);
    if (!pos) return;
    const d = this.down;
    if (d.unit === 'char' || !d.origin) {
      this.sel = { anchor: this.sel.anchor, focus: pos };
    } else {
      const run = findRun(this.allRuns, pos.pageIndex, pos.elementId)!;
      const r = d.unit === 'word' ? wordRange(run.text, pos.offset) : paragraphRange(run.text);
      const before = comparePos(this.allRuns, pos, d.origin.from) < 0;
      this.sel = before
        ? { anchor: d.origin.to, focus: { ...pos, offset: r.from } }
        : { anchor: d.origin.from, focus: { ...pos, offset: r.to } };
    }
    this.refresh();
  }

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    if (!d) return;
    this.down = null;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* 已释放 */
    }
    if (d.suppressClick || d.moved || d.count > 1) return;
    // 单击：落在标注上 → 标注菜单；否则收起选区
    if (d.ann) {
      this.sel = null;
      this.openMenu({ kind: 'annotation', groupId: d.ann.groupId }, this.local(e));
    } else {
      this.clearSelection();
    }
  };

  private pointOnUi(x: number, y: number) {
    if (this.menu && inBox(this.menu.layout.box, x, y)) return true;
    if (this.note && inBox(layoutNote(this.note.at, this.screen.viewport()).box, x, y)) return true;
    if (this.find && inBox(layoutFindBar(this.screen.viewport()).box, x, y)) return true;
    if (this.panel && inBox(layoutPanel(this.screen.viewport()).box, x, y)) return true;
    return false;
  }

  /** 屏幕层控件优先于舞台：命中则在引擎看到事件之前吞掉 */
  private onWindowPointerDown = (e: PointerEvent) => {
    if (!this.enabled || this.engine.isEditing()) return;
    const r = this.engine.getContainer().getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) return;
    const p = this.local(e);
    const swallow = () => {
      e.stopPropagation();
      e.preventDefault();
    };
    const vp = this.screen.viewport();

    if (this.note) {
      const L = layoutNote(this.note.at, vp);
      if (inBox(L.box, p.x, p.y)) {
        swallow();
        if (e.button !== 0) return;
        if (inBox(L.save, p.x, p.y)) this.commitNote();
        else if (inBox(L.cancel, p.x, p.y)) this.closeNote();
        else this.proxy.focus({ preventScroll: true });
        return;
      }
    }
    if (this.menu) {
      if (inBox(this.menu.layout.box, p.x, p.y)) {
        swallow();
        if (e.button !== 0) return;
        const h = hitMenu(this.menu.layout, p.x, p.y);
        if (h) this.runAction(h.id);
        return;
      }
      this.menu = null;
      this.refresh();
    }
    if (this.find) {
      const L = layoutFindBar(vp);
      if (inBox(L.box, p.x, p.y)) {
        swallow();
        if (e.button !== 0) return;
        if (inBox(L.prev, p.x, p.y)) this.stepFind(-1);
        else if (inBox(L.next, p.x, p.y)) this.stepFind(1);
        else if (inBox(L.close, p.x, p.y)) this.closeFind();
        else this.proxy.focus({ preventScroll: true });
        return;
      }
    }
    if (this.panel) {
      const L = layoutPanel(vp);
      if (inBox(L.box, p.x, p.y)) {
        swallow();
        if (e.button !== 0) return;
        const items = this.panelItems();
        const h = hitPanel(L, this.panel.scroll, items.length, p.x, p.y);
        if (h === 'close') this.togglePanel();
        else if (typeof h === 'number') this.goToPage(items[h].pageIndex);
        return;
      }
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled || !this.panel) return;
    const p = this.local(e);
    const L = layoutPanel(this.screen.viewport());
    if (!inBox(L.box, p.x, p.y)) return;
    e.preventDefault();
    this.panel.scroll = clampPanelScroll(this.panel.scroll + e.deltaY, this.panelItems().length, L.list.h);
    this.refresh();
  };

  private onContextMenu = (e: MouseEvent) => {
    if (!this.enabled || this.engine.isEditing()) return;
    e.preventDefault();
    e.stopPropagation();
    const p = this.local(e);
    if (this.pointOnUi(p.x, p.y)) return;
    if (this.down) this.down.suppressClick = true;

    const coords = this.engine.getCanvasCoordsFromClient(e.clientX, e.clientY);
    const hit = coords ? posAtPoint(this.visibleRuns(), coords.pageIndex, coords.canvasX, coords.canvasY, false) : null;
    if (hit && this.hasSelection()) {
      const inSel = segmentsOf(this.allRuns, this.sel!.anchor, this.sel!.focus).some(
        (s) => s.run.pageIndex === hit.pageIndex && s.run.elementId === hit.elementId && hit.offset >= s.from && hit.offset <= s.to
      );
      if (inSel) return void this.openMenu({ kind: 'selection' }, p);
    }
    const ann = hit ? this.annotationAt(hit) : null;
    if (ann) {
      this.sel = null;
      return void this.openMenu({ kind: 'annotation', groupId: ann.groupId }, p);
    }
    if (hit) {
      const run = findRun(this.allRuns, hit.pageIndex, hit.elementId)!;
      const r = wordRange(run.text, hit.offset);
      this.sel = { anchor: { ...hit, offset: r.from }, focus: { ...hit, offset: r.to } };
      return void this.openMenu({ kind: 'selection' }, p);
    }
    this.sel = null;
    this.openMenu({ kind: 'page', pageIndex: coords?.pageIndex ?? this.currentPage() }, p);
  };

  // ---------- 菜单 ----------

  private styleRow(active?: AnnotationType): RowButton[] {
    return STYLE_BUTTONS.map((b) => ({
      id: `style:${b.type}`,
      title: b.title,
      icon: b.type,
      color: this.color,
      active: active === b.type,
    }));
  }

  private colorRow(active: string): RowButton[] {
    return ANNOTATION_COLORS.map((c) => ({ id: `color:${c}`, title: c, icon: 'swatch', color: c, active: active === c }));
  }

  private menuEntries(ctx: MenuCtx): MenuEntry[] {
    const sep: MenuEntry = { kind: 'sep' };
    if (ctx.kind === 'selection') {
      return [
        { kind: 'item', id: 'copy', label: '复制', hint: 'Ctrl+C' },
        sep,
        { kind: 'row', label: '划线', buttons: this.styleRow() },
        { kind: 'row', label: '颜色', buttons: this.colorRow(this.color) },
        sep,
        { kind: 'item', id: 'note', label: '写笔记' },
        { kind: 'item', id: 'searchSel', label: '在书中搜索' },
        { kind: 'item', id: 'speak', label: '朗读' },
      ];
    }
    if (ctx.kind === 'annotation') {
      const a = this.resolved().find((x) => x.groupId === ctx.groupId);
      const group = this.resolved().filter((x) => x.groupId === ctx.groupId);
      return [
        { kind: 'item', id: 'copyAnn', label: '复制' },
        sep,
        { kind: 'row', label: '样式', buttons: this.styleRow(a?.type) },
        { kind: 'row', label: '颜色', buttons: this.colorRow(a?.color ?? '') },
        sep,
        { kind: 'item', id: 'note', label: group[0]?.note ? '编辑笔记' : '添加笔记' },
        { kind: 'item', id: 'deleteAnn', label: '删除标注' },
      ];
    }
    const marked = this.bookmarks.has(ctx.pageIndex);
    return [
      { kind: 'item', id: 'selectPage', label: '全选本页', hint: 'Ctrl+A' },
      { kind: 'item', id: 'find', label: '在书中查找', hint: 'Ctrl+F' },
      sep,
      { kind: 'item', id: 'bookmark', label: marked ? '取消书签' : '添加书签', hint: 'Ctrl+D' },
      { kind: 'item', id: 'panel', label: '标注与书签', hint: 'Ctrl+⇧+L' },
      { kind: 'item', id: 'speakPage', label: '朗读本页' },
    ];
  }

  private openMenu(ctx: MenuCtx, at: { x: number; y: number }) {
    this.tooltip = null;
    const layout = layoutMenu(this.menuEntries(ctx), at, this.screen.viewport());
    this.menu = { layout, hover: null, ctx, at };
    this.refresh();
  }

  private rebuildMenu() {
    if (!this.menu) return;
    this.menu.layout = layoutMenu(this.menuEntries(this.menu.ctx), this.menu.at, this.screen.viewport());
    this.refresh();
  }

  private groupText(groupId: string) {
    return this.resolved()
      .filter((a) => a.groupId === groupId)
      .map((a) => a.quote)
      .join('\n');
  }

  private runAction(id: string) {
    const ctx = this.menu?.ctx;
    if (!ctx) return;

    if (id.startsWith('color:')) {
      this.color = id.slice(6);
      if (ctx.kind === 'annotation') {
        this.annotations = updateGroup(this.annotations, ctx.groupId, { color: this.color });
        this.resolvedCache = null;
        this.persist();
      }
      return this.rebuildMenu();
    }
    if (id.startsWith('style:')) {
      const type = id.slice(6) as AnnotationType;
      if (ctx.kind === 'annotation') {
        this.annotations = updateGroup(this.annotations, ctx.groupId, { type });
      } else if (ctx.kind === 'selection' && this.sel) {
        this.annotations = [
          ...this.annotations,
          ...createAnnotations(this.allRuns, this.sel.anchor, this.sel.focus, { type, color: this.color }),
        ];
        this.sel = null;
      }
      this.resolvedCache = null;
      this.persist();
      return this.closeMenu();
    }

    switch (id) {
      case 'copy':
        void this.copySelection();
        break;
      case 'copyAnn':
        if (ctx.kind === 'annotation') {
          void this.services.clipboard.writeText(this.groupText(ctx.groupId)).then((ok) => this.toast(ok ? '已复制' : '复制失败'));
        }
        break;
      case 'note': {
        let groupId = ctx.kind === 'annotation' ? ctx.groupId : '';
        if (ctx.kind === 'selection' && this.sel) {
          const created = createAnnotations(this.allRuns, this.sel.anchor, this.sel.focus, { type: 'underline', color: this.color });
          if (created.length === 0) break;
          this.annotations = [...this.annotations, ...created];
          this.resolvedCache = null;
          groupId = created[0].groupId;
          this.sel = null;
        }
        const existing = this.resolved().find((a) => a.groupId === groupId)?.note ?? '';
        const at = this.menu!.at;
        this.menu = null;
        this.openNote(groupId, existing, at);
        return;
      }
      case 'deleteAnn':
        if (ctx.kind === 'annotation') {
          this.annotations = removeGroup(this.annotations, ctx.groupId);
          this.resolvedCache = null;
          this.persist();
        }
        break;
      case 'searchSel':
        this.menu = null;
        this.openFind();
        return;
      case 'speak':
        this.services.speech.speak(this.selectedText());
        break;
      case 'speakPage': {
        const p = this.currentPage();
        this.services.speech.speak(
          this.allRuns
            .filter((r) => r.pageIndex === p)
            .map((r) => r.text)
            .join('\n')
        );
        break;
      }
      case 'selectPage':
        this.selectPage(ctx.kind === 'page' ? ctx.pageIndex : this.currentPage());
        break;
      case 'find':
        this.menu = null;
        this.openFind();
        return;
      case 'bookmark':
        this.toggleBookmark(ctx.kind === 'page' ? ctx.pageIndex : this.currentPage());
        break;
      case 'panel':
        this.menu = null;
        this.togglePanel();
        return;
    }
    this.closeMenu();
  }

  private closeMenu() {
    this.menu = null;
    this.refresh();
  }

  private selectPage(pageIndex: number) {
    const runs = this.allRuns.filter((r) => r.pageIndex === pageIndex);
    if (runs.length === 0) return;
    const last = runs[runs.length - 1];
    this.sel = {
      anchor: { pageIndex, elementId: runs[0].elementId, offset: 0 },
      focus: { pageIndex, elementId: last.elementId, offset: last.text.length },
    };
  }

  private toggleBookmark(pageIndex: number) {
    const next = new Set(this.bookmarks);
    if (next.has(pageIndex)) next.delete(pageIndex);
    else next.add(pageIndex);
    this.bookmarks = next;
    this.persist();
    this.toast(next.has(pageIndex) ? '已添加书签' : '已取消书签');
  }

  // ---------- 笔记 / 查找（隐藏 textarea 只负责 IME 与键盘，文字一律画在 canvas 上） ----------

  private createProxy(container: HTMLElement) {
    const ta = document.createElement('textarea');
    ta.setAttribute('aria-label', 'reader input proxy');
    ta.tabIndex = -1;
    ta.spellcheck = false;
    ta.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;font-size:16px;resize:none;outline:none;border:none;padding:0;';
    container.appendChild(ta);
    const sig = { signal: this.abort.signal };
    ta.addEventListener('input', () => this.onProxyInput(), sig);
    ta.addEventListener('keyup', () => this.syncCaret(), sig);
    ta.addEventListener('select', () => this.syncCaret(), sig);
    ta.addEventListener('keydown', (e) => this.onProxyKey(e), sig);
    return ta;
  }

  private focusProxy(value: string) {
    this.proxy.value = value;
    this.proxy.focus({ preventScroll: true });
    this.proxy.setSelectionRange(value.length, value.length);
    this.refresh();
  }

  private syncCaret() {
    const c = this.proxy.selectionEnd ?? 0;
    if (this.note) this.note.caret = c;
    else if (this.find) this.find.caret = c;
    this.refresh();
  }

  private onProxyInput() {
    const v = this.proxy.value;
    if (this.note) {
      this.note.text = v;
    } else if (this.find) {
      this.find.query = v;
      this.runSearch(true);
    }
    this.syncCaret();
  }

  private onProxyKey(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229) return;
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.note) this.closeNote();
      else this.closeFind();
    } else if (e.key === 'Enter') {
      if (this.note && !e.shiftKey) {
        e.preventDefault();
        this.commitNote();
      } else if (this.find) {
        e.preventDefault();
        this.stepFind(e.shiftKey ? -1 : 1);
      }
    }
  }

  private openNote(groupId: string, text: string, at: { x: number; y: number }) {
    this.note = { groupId, text, caret: text.length, at, hover: null };
    this.focusProxy(text);
  }

  private commitNote() {
    if (!this.note) return;
    this.annotations = setGroupNote(this.annotations, this.note.groupId, this.note.text.trim());
    this.resolvedCache = null;
    this.persist();
    this.closeNote();
  }

  private closeNote() {
    this.note = null;
    this.proxy.blur();
    this.refresh();
  }

  private runSearch(jump = false) {
    if (!this.find) return;
    this.find.matches = findMatches(this.allRuns, this.find.query);
    this.find.index = firstMatchFrom(this.find.matches, this.currentPage());
    if (jump) this.revealMatch();
    this.refresh();
  }

  private stepFind(dir: -1 | 1) {
    const f = this.find;
    if (!f || f.matches.length === 0) return;
    f.index = (f.index + dir + f.matches.length) % f.matches.length;
    this.revealMatch();
    this.refresh();
  }

  private revealMatch() {
    const m = this.find?.matches[this.find.index];
    if (m) this.goToPage(m.pageIndex);
  }

  private closeFind() {
    this.find = null;
    this.proxy.blur();
    this.refresh();
  }

  // ---------- 键盘 ----------

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled || this.engine.isEditing()) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const inInput = isTextInput(e.target) && e.target !== this.proxy;
    if (inInput) return;
    if (e.target === this.proxy) {
      if (mod && key === 'f') {
        e.preventDefault();
        this.proxy.select();
      }
      return;
    }

    if (mod && key === 'c' && this.hasSelection()) {
      e.preventDefault();
      void this.copySelection();
    } else if (mod && key === 'a') {
      e.preventDefault();
      this.selectPage(this.currentPage());
      this.refresh();
    } else if (mod && key === 'f') {
      e.preventDefault();
      this.openFind();
    } else if (mod && key === 'd') {
      e.preventDefault();
      this.toggleBookmark(this.currentPage());
    } else if (mod && e.shiftKey && key === 'l') {
      e.preventDefault();
      this.togglePanel();
    } else if (e.key === 'Escape') {
      if (this.menu) this.closeMenu();
      else if (this.panel) this.togglePanel();
      else if (this.find) this.closeFind();
      else if (this.sel) this.clearSelection();
      this.services.speech.cancel();
    }
  };

  // ---------- 绘制 ----------

  private panelItems(): PanelItem[] {
    const items: PanelItem[] = [...this.bookmarks]
      .sort((a, b) => a - b)
      .map((p) => ({ kind: 'bookmark' as const, title: this.pages[p]?.title || `第 ${p + 1} 页`, sub: `书签 · 第 ${p + 1} 页`, pageIndex: p }));
    const seen = new Set<string>();
    for (const a of this.resolved()) {
      if (seen.has(a.groupId)) continue;
      seen.add(a.groupId);
      const text = this.groupText(a.groupId).replace(/\n/g, ' ');
      const note = this.resolved().find((x) => x.groupId === a.groupId)?.note;
      items.push({ kind: 'annotation', title: text, sub: `第 ${a.pageIndex + 1} 页${note ? ' · ' + note : ''}`, color: a.color, pageIndex: a.pageIndex });
    }
    return items;
  }

  private computeOverlays(): Map<number, ReaderPageOverlay> {
    const out = new Map<number, ReaderPageOverlay>();
    const at = (p: number) => {
      let o = out.get(p);
      if (!o) out.set(p, (o = {}));
      return o;
    };
    if (!this.enabled) return out;
    for (const a of this.resolved()) {
      (at(a.pageIndex).annotations ??= []).push({
        type: a.type,
        color: a.color,
        elementId: a.elementId,
        from: a.from,
        to: a.to,
        hasNote: !!a.note,
      });
    }
    this.find?.matches.forEach((m, i) => {
      (at(m.pageIndex).search ??= []).push({ elementId: m.elementId, from: m.from, to: m.to, current: i === this.find!.index });
    });
    if (this.sel && this.hasSelection()) {
      for (const s of segmentsOf(this.allRuns, this.sel.anchor, this.sel.focus)) {
        (at(s.run.pageIndex).selection ??= []).push({ elementId: s.run.elementId, from: s.from, to: s.to });
      }
    }
    for (const p of this.bookmarks) at(p).bookmarked = true;
    return out;
  }

  private refresh() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.flush();
    });
  }

  private flush() {
    const next = this.computeOverlays();
    const pages = new Set([...this.lastOverlay.keys(), ...next.keys()]);
    for (const p of pages) {
      const o = next.get(p);
      const json = o ? JSON.stringify(o) : '';
      if ((this.lastOverlay.get(p) ?? '') === json) continue;
      if (json) this.lastOverlay.set(p, json);
      else this.lastOverlay.delete(p);
      this.engine.setPageReaderOverlay(p, o ?? null);
    }

    const theme = this.getTheme();
    const vp = this.screen.viewport();
    const state: ScreenState = {};
    if (this.enabled) {
      if (this.panel) {
        state.panel = { layout: layoutPanel(vp), scroll: this.panel.scroll, items: this.panelItems(), hover: this.panel.hover };
      }
      if (this.find) {
        const f = this.find;
        state.find = {
          layout: layoutFindBar(vp),
          query: f.query,
          caret: f.caret,
          hover: f.hover,
          label: f.query ? (f.matches.length ? `${f.index + 1}/${f.matches.length}` : '无结果') : '',
        };
      }
      if (this.menu) state.menu = { layout: this.menu.layout, hover: this.menu.hover };
      if (this.note) state.note = { layout: layoutNote(this.note.at, vp), text: this.note.text, caret: this.note.caret, hover: this.note.hover };
      if (this.tooltip && !this.menu) state.tooltip = this.tooltip;
      if (this.toastState) {
        const left = this.toastState.until - performance.now();
        if (left > 0) {
          state.toast = { text: this.toastState.text, alpha: Math.min(1, left / 300) };
          this.refresh();
        } else {
          this.toastState = null;
        }
      }
    }
    this.screen.draw(state, theme);
  }
}

