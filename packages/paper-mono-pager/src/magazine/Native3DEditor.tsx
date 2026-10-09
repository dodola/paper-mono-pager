import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PageContent } from './chinesePublicationData';
import {
  PageLayoutElement,
  getCachedLayoutElements,
  findLayoutElementAtCoords,
} from './pageLayout';
import { MagazineEngine } from './MagazineEngine';
import { applyTextOverride, PageEditState } from './pageRenderer';
import { caretGeometry, indexAtPoint, moveCaretVertically } from './textMetrics';
import {
  insertParagraph,
  removeParagraph,
  splitParagraph,
  mergeWithPrevious,
  supportsParagraphs,
  validateImportedPages,
  EditResult,
} from './pageEdit';
import {
  Check,
  RotateCcw,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Stamp,
  Sparkles,
  X,
} from 'lucide-react';

export interface Native3DEditorProps {
  engine: MagazineEngine | null;
  currentSheet: number;
  totalSheets: number;
  leftPageNum: number | null;
  rightPageNum: number | null;
  pages: PageContent[];
  onUpdatePage: (pageIndex: number, newPage: PageContent) => void;
  onResetPage: (pageIndex: number) => void;
  onGoToSheet: (sheetIdx: number) => void;
  onCloseEditMode: () => void;
  onImportPages: (newPages: PageContent[]) => void;
}

interface Target {
  pageIndex: number;
  id: string;
}

const SEAL_PRESETS = ['澄怀', '知行', '文心', '雅集', '致虚', '守静', '逸兴', '栖迟'];
const SEAL_PAGE_TYPES: PageContent['type'][] = ['cover', 'colophon', 'frontispiece', 'chapter'];
const CHROME_ATTR = 'data-editor-chrome';

export const Native3DEditor: React.FC<Native3DEditorProps> = ({
  engine,
  currentSheet,
  totalSheets,
  leftPageNum,
  rightPageNum,
  pages,
  onUpdatePage,
  onResetPage,
  onGoToSheet,
  onCloseEditMode,
  onImportPages,
}) => {
  // 仅工具栏需要的状态走 React；高频的 hover/光标/选区全部走 ref，避免重渲染
  const [active, setActive] = useState<Target | null>(null);
  const [showSealModal, setShowSealModal] = useState(false);
  const [customSealText, setCustomSealText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');

  const stageRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const activeRef = useRef<Target | null>(null);
  const hoverRef = useRef<Target | null>(null);
  const selRef = useRef({ start: 0, end: 0 });
  const caretOnRef = useRef(true);
  const lastActivityRef = useRef(0);
  const dragRef = useRef<{ target: Target; anchor: number } | null>(null);
  const rafRef = useRef(0);
  const lastMoveRef = useRef<{ x: number; y: number } | null>(null);

  const layoutOf = (pageIndex: number) => {
    const page = pagesRef.current[pageIndex];
    return page ? getCachedLayoutElements(page, pageIndex) : [];
  };
  const findElement = (t: Target | null) =>
    t ? layoutOf(t.pageIndex).find((e) => e.id === t.id) ?? null : null;

  const activeElement = useMemo(() => {
    if (!active) return null;
    const page = pages[active.pageIndex];
    return page
      ? getCachedLayoutElements(page, active.pageIndex).find((e) => e.id === active.id) ?? null
      : null;
  }, [pages, active]);

  const activePageIndex = active
    ? active.pageIndex
    : rightPageNum !== null
    ? rightPageNum - 1
    : leftPageNum !== null
    ? leftPageNum - 1
    : 0;
  const activePage = pages[activePageIndex];

  // ---------- 绘制 ----------
  const editStateFor = (pageIndex: number): PageEditState | null => {
    const a = activeRef.current;
    const h = hoverRef.current;
    const act = a && a.pageIndex === pageIndex ? a : null;
    const hov = h && h.pageIndex === pageIndex ? h.id : null;
    if (!act && !hov) return null;
    return {
      activeElementId: act?.id ?? null,
      hoveredElementId: hov,
      caretVisible: caretOnRef.current,
      selectionStart: selRef.current.start,
      selectionEnd: selRef.current.end,
    };
  };
  const paint = (pageIndex: number, render = true) =>
    engine?.updatePageEditState(pageIndex, editStateFor(pageIndex), { render });

  const touchCaret = () => {
    lastActivityRef.current = Date.now();
    caretOnRef.current = true;
  };

  /** IME 候选窗跟随光标 */
  const updateProxyPos = () => {
    const el = findElement(activeRef.current);
    const ta = taRef.current;
    if (!el || !ta || !engine) return;
    const g = caretGeometry(el.style, el.text, selRef.current.end);
    const p = engine.getClientCoordsFromCanvas(el.pageIndex, g.x, g.top + g.height);
    if (p) {
      ta.style.left = `${p.x}px`;
      ta.style.top = `${p.y}px`;
    }
  };

  const commitPage = (pageIndex: number, page: PageContent) => {
    pagesRef.current = pagesRef.current.map((p, i) => (i === pageIndex ? page : p));
    onUpdatePage(pageIndex, page);
  };

  const syncSelection = () => {
    const ta = taRef.current;
    if (!ta || !activeRef.current) return;
    const start = Math.min(ta.selectionStart, ta.selectionEnd);
    const end = Math.max(ta.selectionStart, ta.selectionEnd);
    if (start === selRef.current.start && end === selRef.current.end) return;
    selRef.current = { start, end };
    touchCaret();
    paint(activeRef.current.pageIndex);
    updateProxyPos();
  };

  // ---------- 激活 / 取消激活 ----------
  const activate = (el: PageLayoutElement, caret?: number) => {
    const prev = activeRef.current;
    const next = { pageIndex: el.pageIndex, id: el.id };
    activeRef.current = next;
    setActive(next);

    const ta = taRef.current;
    if (ta) {
      ta.value = el.text;
      if (el.maxLength) ta.maxLength = el.maxLength;
      else ta.removeAttribute('maxlength');
      ta.focus({ preventScroll: true });
      if (el.type === 'seal') ta.select();
      else {
        const c = Math.max(0, Math.min(caret ?? el.text.length, el.text.length));
        ta.setSelectionRange(c, c);
      }
      selRef.current = { start: ta.selectionStart, end: ta.selectionEnd };
    }
    touchCaret();
    if (prev && prev.pageIndex !== next.pageIndex) paint(prev.pageIndex);
    paint(next.pageIndex);
    updateProxyPos();

    if (el.type === 'seal') {
      setCustomSealText(el.text);
      setShowSealModal(true);
    }
  };

  /** 离开空段落时自动清理，返回被删段落的下标 */
  const pruneEmptyActive = (): { pageIndex: number; index: number } | null => {
    const el = findElement(activeRef.current);
    if (!el || el.type !== 'paragraph' || el.text !== '' || el.paragraphIndex === undefined) return null;
    const page = pagesRef.current[el.pageIndex];
    commitPage(el.pageIndex, removeParagraph(page, el.paragraphIndex).page);
    return { pageIndex: el.pageIndex, index: el.paragraphIndex };
  };

  const deactivate = (prune = true) => {
    const prev = activeRef.current;
    if (!prev) return;
    if (prune) pruneEmptyActive();
    activeRef.current = null;
    setActive(null);
    taRef.current?.blur();
    paint(prev.pageIndex);
  };

  const applyEdit = (pageIndex: number, result: EditResult) => {
    commitPage(pageIndex, result.page);
    if (result.focusId) {
      const el = layoutOf(pageIndex).find((e) => e.id === result.focusId);
      if (el) {
        activate(el, result.caret);
        return;
      }
    }
    deactivate(false);
  };

  // ---------- 生命周期 ----------
  useEffect(() => {
    if (!engine) return;
    engine.setEditMode(true);
    return () => {
      cancelAnimationFrame(rafRef.current);
      engine.setEditMode(false);
      engine.clearAllEditStates();
    };
  }, [engine]);

  // 翻页后上一页的编辑目标已不可见：收起选中与悬停
  useEffect(() => {
    const h = hoverRef.current;
    hoverRef.current = null;
    if (h) paint(h.pageIndex);
    deactivate();
    if (stageRef.current) stageRef.current.style.cursor = 'default';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSheet]);

  // 光标闪烁：输入后常亮，空闲才闪；仅重合成当前页覆盖层
  useEffect(() => {
    if (!active || !engine) return;
    const timer = setInterval(() => {
      const a = activeRef.current;
      if (!a) return;
      if (Date.now() - lastActivityRef.current < 700) {
        if (caretOnRef.current) return;
        caretOnRef.current = true;
      } else {
        caretOnRef.current = !caretOnRef.current;
      }
      paint(a.pageIndex);
    }, 530);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.pageIndex, active?.id, engine]);

  // ---------- 鼠标 ----------
  const isChrome = (t: EventTarget | null) =>
    t instanceof Element && t.closest(`[${CHROME_ATTR}]`) !== null;

  const pick = (clientX: number, clientY: number) => {
    const coords = engine?.getCanvasCoordsFromClient(clientX, clientY);
    if (!coords) return null;
    const hit = findLayoutElementAtCoords(layoutOf(coords.pageIndex), coords.canvasX, coords.canvasY);
    return { coords, hit };
  };

  const processHover = () => {
    rafRef.current = 0;
    const m = lastMoveRef.current;
    if (!m || !engine) return;
    const picked = pick(m.x, m.y);
    const hit = picked?.hit ?? null;
    const prev = hoverRef.current;
    if (prev?.id === hit?.id && prev?.pageIndex === hit?.pageIndex) return;
    hoverRef.current = hit ? { pageIndex: hit.pageIndex, id: hit.id } : null;
    if (prev && prev.pageIndex !== hit?.pageIndex) paint(prev.pageIndex);
    if (hit) paint(hit.pageIndex);
    else if (prev) paint(prev.pageIndex);
    if (stageRef.current) {
      stageRef.current.style.cursor = hit ? (hit.type === 'seal' ? 'pointer' : 'text') : 'default';
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!engine) return;
    const drag = dragRef.current;
    if (drag && e.buttons & 1) {
      const coords = engine.getCanvasCoordsFromClient(e.clientX, e.clientY);
      const el = findElement(drag.target);
      const ta = taRef.current;
      if (coords && el && ta && coords.pageIndex === drag.target.pageIndex) {
        const idx = indexAtPoint(el.style, el.text, coords.canvasX, coords.canvasY);
        ta.setSelectionRange(Math.min(idx, drag.anchor), Math.max(idx, drag.anchor));
        syncSelection();
      }
      return;
    }
    if (isChrome(e.target)) {
      lastMoveRef.current = { x: -1, y: -1 };
    } else {
      lastMoveRef.current = { x: e.clientX, y: e.clientY };
    }
    if (!rafRef.current) rafRef.current = requestAnimationFrame(processHover);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !engine) return;
    if (isChrome(e.target)) {
      // 工具栏点击不夺走输入焦点（弹窗内的输入框除外）
      const tag = (e.target as HTMLElement).tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
      return;
    }
    e.preventDefault(); // 保持代理输入框焦点

    const picked = pick(e.clientX, e.clientY);
    let hit = picked?.hit ?? null;

    // 离开空段落：清理后修正命中目标的下标
    const prev = findElement(activeRef.current);
    if (prev && (!hit || hit.id !== prev.id || hit.pageIndex !== prev.pageIndex)) {
      const pruned = pruneEmptyActive();
      if (pruned && hit && hit.pageIndex === pruned.pageIndex) {
        const id =
          hit.type === 'paragraph' && hit.paragraphIndex! > pruned.index
            ? `paragraph-${hit.paragraphIndex! - 1}`
            : hit.id;
        hit = layoutOf(hit.pageIndex).find((el) => el.id === id) ?? null;
      }
    }

    if (!hit || !picked) {
      deactivate(false);
      return;
    }

    const sameTarget =
      activeRef.current?.id === hit.id && activeRef.current.pageIndex === hit.pageIndex;
    const caret = indexAtPoint(hit.style, hit.text, picked.coords.canvasX, picked.coords.canvasY);
    if (sameTarget && taRef.current) {
      taRef.current.focus({ preventScroll: true });
      taRef.current.setSelectionRange(caret, caret);
      syncSelection();
    } else {
      activate(hit, caret);
    }
    dragRef.current = { target: { pageIndex: hit.pageIndex, id: hit.id }, anchor: caret };
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isChrome(e.target) || !activeRef.current) return;
    taRef.current?.select();
    syncSelection();
  };

  const handleMouseLeave = () => {
    endDrag();
    const h = hoverRef.current;
    if (h) {
      hoverRef.current = null;
      paint(h.pageIndex);
    }
  };

  // ---------- 键盘 / 输入 ----------
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = findElement(activeRef.current);
    if (!el) return;
    const ta = e.currentTarget;
    const composing = (e.nativeEvent as InputEvent).isComposing;
    let val = ta.value;
    if (!composing) {
      const cleaned = val.replace(/[\r\n]+/g, '');
      const limited = el.maxLength ? cleaned.slice(0, el.maxLength) : cleaned;
      if (limited !== val) {
        val = limited;
        ta.value = val;
        ta.setSelectionRange(val.length, val.length);
      }
    }
    selRef.current = { start: ta.selectionStart, end: ta.selectionEnd };
    touchCaret();
    // 先登记编辑状态（不绘制），再由内容提交一次性合成，避免双重渲染
    engine?.updatePageEditState(el.pageIndex, editStateFor(el.pageIndex), { render: false });
    commitPage(el.pageIndex, applyTextOverride(pagesRef.current[el.pageIndex], el.id, val));
    updateProxyPos();
  };

  const stepElement = (el: PageLayoutElement, dir: -1 | 1, atEnd: boolean) => {
    const list = layoutOf(el.pageIndex);
    const i = list.findIndex((x) => x.id === el.id);
    const next = list[i + dir];
    if (next) activate(next, atEnd ? next.text.length : 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = findElement(activeRef.current);
    if (!el) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const ta = e.currentTarget;
    const { selectionStart: s, selectionEnd: en } = ta;
    const page = pagesRef.current[el.pageIndex];

    if (e.key === 'Escape') {
      e.preventDefault();
      deactivate();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (el.type === 'paragraph' && el.paragraphIndex !== undefined) {
        const lo = Math.min(s, en);
        const hi = Math.max(s, en);
        const text = ta.value.slice(0, lo) + ta.value.slice(hi);
        const edited = applyTextOverride(page, el.id, text);
        const r = splitParagraph(edited, el.paragraphIndex, lo);
        if (r) applyEdit(el.pageIndex, r);
      } else {
        deactivate();
      }
    } else if (
      e.key === 'Backspace' &&
      s === 0 &&
      en === 0 &&
      el.type === 'paragraph' &&
      el.paragraphIndex !== undefined
    ) {
      const r = mergeWithPrevious(page, el.paragraphIndex);
      if (r) {
        e.preventDefault();
        applyEdit(el.pageIndex, r);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      stepElement(el, e.shiftKey ? -1 : 1, false);
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      const idx = moveCaretVertically(el.style, el.text, e.shiftKey ? en : s, dir);
      if (idx !== null) {
        if (e.shiftKey) ta.setSelectionRange(Math.min(s, idx), Math.max(s, idx));
        else ta.setSelectionRange(idx, idx);
      } else if (!e.shiftKey) {
        stepElement(el, dir, dir < 0);
      }
    }
    requestAnimationFrame(syncSelection);
  };

  // ---------- 工具栏动作 ----------
  const handleAddParagraph = () => {
    if (!activePage || !supportsParagraphs(activePage)) return;
    pruneEmptyActive();
    const after = activeElement?.paragraphIndex ?? null;
    applyEdit(activePageIndex, insertParagraph(pagesRef.current[activePageIndex], after));
  };

  const handleDeleteParagraph = () => {
    if (!activeElement || activeElement.paragraphIndex === undefined) return;
    const idx = activeElement.paragraphIndex;
    const page = pagesRef.current[activeElement.pageIndex];
    commitPage(activeElement.pageIndex, removeParagraph(page, idx).page);
    deactivate(false);
  };

  const handleSelectSeal = (seal: string) => {
    const pageIdx = activePageIndex;
    const page = pagesRef.current[pageIdx];
    if (!page || !SEAL_PAGE_TYPES.includes(page.type)) return;
    commitPage(pageIdx, { ...page, sealText: seal });
    if (activeRef.current?.id === 'seal' && taRef.current) taRef.current.value = seal;
    setShowSealModal(false);
  };

  const handleReset = () => {
    deactivate(false);
    onResetPage(activePageIndex);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(pages, null, 2);
    navigator.clipboard?.writeText(dataStr).catch(() => {});
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paper-mono-book-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportSubmit = () => {
    setImportError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJsonText);
    } catch {
      setImportError('JSON 格式解析失败');
      return;
    }
    const result = validateImportedPages(parsed, pages.length);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    deactivate(false);
    onImportPages(result.pages);
    setShowImportModal(false);
    setImportJsonText('');
  };

  const canAddParagraph = !!activePage && supportsParagraphs(activePage);
  const canStamp = !!activePage && SEAL_PAGE_TYPES.includes(activePage.type);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={stageRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={endDrag}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      className="absolute inset-0 size-full pointer-events-auto z-40 select-none"
    >
      {/* 隐藏式 IME 代理输入框：位置跟随 3D 页面上的光标 */}
      <textarea
        ref={taRef}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={syncSelection}
        onSelect={syncSelection}
        aria-label="3D Paper Native Editor IME Proxy"
        tabIndex={-1}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          fontSize: '16px',
          resize: 'none',
          outline: 'none',
          border: 'none',
          padding: 0,
        }}
      />

      {/* 悬浮工具栏 */}
      <div
        {...{ [CHROME_ATTR]: '' }}
        onClick={stop}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#E2DDD3] shadow-lg text-xs text-[#242220] whitespace-nowrap animate-in fade-in slide-in-from-top-2 font-serif pointer-events-auto"
      >
        <div className="flex items-center gap-1.5 pr-2 border-r border-[#E2DDD3]">
          <span className="size-2 rounded-full bg-[#9B2D26] animate-pulse" />
          <span className="font-bold text-[#9B2D26]">原生 3D 排印</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => currentSheet > 0 && onGoToSheet(currentSheet - 1)}
            disabled={currentSheet <= 0}
            className="p-1 hover:bg-black/5 disabled:opacity-30 rounded transition-colors"
            title="前一印张"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="font-mono text-[11px] px-1 font-bold">
            {currentSheet === 0
              ? '封面'
              : currentSheet === totalSheets
              ? '封底'
              : `第 ${2 * currentSheet}-${2 * currentSheet + 1} 页`}
          </span>
          <button
            onClick={() => currentSheet < totalSheets && onGoToSheet(currentSheet + 1)}
            disabled={currentSheet >= totalSheets}
            className="p-1 hover:bg-black/5 disabled:opacity-30 rounded transition-colors"
            title="后一印张"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E2DDD3]/70 text-[11px] text-[#242220]/75">
          <Sparkles className="size-3 text-[#9B2D26]" />
          <span>
            {activeElement
              ? `正在编辑：第 ${activeElement.pageIndex + 1} 页 · ${activeElement.label}${
                  activeElement.type === 'paragraph' ? ' · Enter 分段 / 行首退格并段' : ' · Enter 完成'
                }`
              : '点击页面文字直接编辑 · Tab 切换 · Esc 退出'}
          </span>
        </div>

        {(canAddParagraph || activeElement?.paragraphIndex !== undefined) && (
          <div className="flex items-center gap-1 pl-1 border-l border-[#E2DDD3]">
            {canAddParagraph && (
              <button
                onClick={handleAddParagraph}
                title="在当前段落后插入新段落"
                className="px-2 py-0.5 rounded bg-black/5 hover:bg-black/10 flex items-center gap-1 text-[11px] font-medium transition-colors"
              >
                <Plus className="size-3 text-[#9B2D26]" />
                <span>加段</span>
              </button>
            )}
            {activeElement?.paragraphIndex !== undefined && (
              <button
                onClick={handleDeleteParagraph}
                title="删除当前选中的段落"
                className="p-1 text-red-700 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => canStamp && setShowSealModal((p) => !p)}
          disabled={!canStamp}
          title={canStamp ? '切换朱砂印章刻印文字' : '本页版式没有印章'}
          className="p-1 rounded hover:bg-black/5 text-[#9B2D26] transition-colors disabled:opacity-30"
        >
          <Stamp className="size-3.5" />
        </button>

        <button
          onClick={handleReset}
          title="重置当前页为初始文本"
          className="p-1 rounded hover:bg-black/5 transition-colors"
        >
          <RotateCcw className="size-3.5" />
        </button>

        <button
          onClick={handleExportJson}
          title="导出整本杂志书籍数据 (JSON)"
          className="p-1 rounded hover:bg-black/5 transition-colors"
        >
          <Download className="size-3.5" />
        </button>

        <button
          onClick={() => setShowImportModal(true)}
          title="导入自定义杂志书籍数据 (JSON)"
          className="p-1 rounded hover:bg-black/5 transition-colors"
        >
          <Upload className="size-3.5" />
        </button>

        <button
          onClick={() => {
            pruneEmptyActive();
            onCloseEditMode();
          }}
          className="ml-1 px-3 py-1 rounded-full bg-[#9B2D26] hover:bg-[#85251F] text-white font-medium flex items-center gap-1 shadow-xs transition-colors"
        >
          <Check className="size-3" />
          <span>完成</span>
        </button>
      </div>

      {/* 朱砂印章弹窗 */}
      {showSealModal && (
        <div
          {...{ [CHROME_ATTR]: '' }}
          onClick={stop}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2DDD3] shadow-2xl w-[320px] animate-in fade-in zoom-in-95 font-serif"
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2DDD3]">
            <div className="flex items-center gap-1.5 text-sm font-bold text-[#9B2D26]">
              <Stamp className="size-4" />
              <span>朱砂印章刻印</span>
            </div>
            <button
              onClick={() => setShowSealModal(false)}
              className="p-1 text-[#242220]/50 hover:text-[#242220] rounded"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="text-xs text-[#242220]/70 mb-2">选择典雅预设印文：</div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {SEAL_PRESETS.map((seal) => (
              <button
                key={seal}
                onClick={() => handleSelectSeal(seal)}
                className="h-10 border border-[#9B2D26]/40 hover:border-[#9B2D26] bg-[#FAF8F5] hover:bg-[#9B2D26] text-[#9B2D26] hover:text-white rounded text-sm font-bold transition-all shadow-xs flex items-center justify-center cursor-pointer"
              >
                {seal}
              </button>
            ))}
          </div>

          <div className="text-xs text-[#242220]/70 mb-1">自定义刻印 (2 或 4 字)：</div>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={4}
              value={customSealText}
              onChange={(e) => setCustomSealText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && customSealText.trim()) {
                  handleSelectSeal(customSealText.trim());
                }
              }}
              placeholder="如：澄怀观道"
              className="flex-1 px-2.5 py-1 text-sm border border-[#E2DDD3] rounded bg-white outline-none focus:ring-1 focus:ring-[#9B2D26]"
            />
            <button
              onClick={() => customSealText.trim() && handleSelectSeal(customSealText.trim())}
              className="px-3 py-1 bg-[#9B2D26] hover:bg-[#85251F] text-white text-xs font-bold rounded shadow-xs"
            >
              盖印
            </button>
          </div>
        </div>
      )}

      {/* JSON 导入弹窗 */}
      {showImportModal && (
        <div
          {...{ [CHROME_ATTR]: '' }}
          onClick={stop}
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#FAF8F5] border border-[#E2DDD3] rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 font-serif">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DDD3]">
              <h3 className="font-bold text-base text-[#242220] flex items-center gap-2">
                <Upload className="size-4 text-[#9B2D26]" />
                <span>导入整本书排印数据 (JSON)</span>
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 text-[#242220]/50 hover:text-[#242220]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="py-4 space-y-3">
              <p className="text-xs text-[#242220]/70">
                可粘贴此前导出的整书 JSON（页数须与当前一致）。提交后 3D 页面将全量重绘。
              </p>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="在此粘贴包含各页面对象的 JSON 数组..."
                className="w-full h-48 p-3 text-xs font-mono bg-white border border-[#E2DDD3] rounded-lg outline-none focus:ring-1 focus:ring-[#9B2D26] resize-none"
              />
              {importError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {importError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2DDD3]">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-1.5 text-xs text-[#242220]/70 hover:bg-black/5 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-4 py-1.5 text-xs bg-[#9B2D26] text-white font-medium rounded-lg hover:bg-[#85251F] shadow-sm"
              >
                确认导入并重绘
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
