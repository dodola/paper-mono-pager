import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PageContent, CHINESE_PAGES } from './chinesePublicationData';
import { PageLayoutElement, getPageLayoutElements, findLayoutElementAtCoords } from './pageLayout';
import { MagazineEngine } from './MagazineEngine';
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
  stageWidth: number;
  stageHeight: number;
  currentSheet: number;
  totalSheets: number;
  leftPageNum: number | null;
  rightPageNum: number | null;
  pages: PageContent[];
  onUpdatePage: (pageIndex: number, newPage: PageContent) => void;
  onResetPage: (pageIndex: number) => void;
  onResetAll: () => void;
  onGoToSheet: (sheetIdx: number) => void;
  onCloseEditMode: () => void;
  onImportPages: (newPages: PageContent[]) => void;
}

const SEAL_PRESETS = ['澄怀', '知行', '文心', '雅集', '致虚', '守静', '逸兴', '栖迟'];

export const Native3DEditor: React.FC<Native3DEditorProps> = ({
  engine,
  currentSheet,
  totalSheets,
  leftPageNum,
  rightPageNum,
  pages,
  onUpdatePage,
  onResetPage,
  onResetAll,
  onGoToSheet,
  onCloseEditMode,
  onImportPages,
}) => {
  // 当前处于选中/激活编辑态的排印元素
  const [activeElement, setActiveElement] = useState<PageLayoutElement | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [hoveredPageIndex, setHoveredPageIndex] = useState<number | null>(null);

  // 隐藏式 IME 代理输入框状态
  const [inputText, setInputText] = useState('');
  const [proxyPos, setProxyPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const proxyInputRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  // 闪烁光标状态 (Blinking Caret)
  const [caretVisible, setCaretVisible] = useState(true);

  // 印章快捷弹出窗
  const [showSealModal, setShowSealModal] = useState(false);
  const [customSealText, setCustomSealText] = useState('');

  // JSON 导入导出弹窗
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');

  // 保持当前页面的有效 pageIndex
  const activePageIndex = activeElement
    ? activeElement.pageIndex
    : rightPageNum !== null
    ? rightPageNum - 1
    : leftPageNum !== null
    ? leftPageNum - 1
    : 0;

  // 1. 启动 Native 3D Editor 模式，退出时清理状态
  useEffect(() => {
    if (!engine) return;
    engine.setEditMode(true);

    return () => {
      engine.setEditMode(false);
      engine.clearAllEditStates();
    };
  }, [engine]);

  // 2. 原生 3D 闪烁打字光标定时器 (530ms 墨笔光标呼吸闪烁)
  useEffect(() => {
    if (!activeElement || !engine) return;

    const timer = setInterval(() => {
      setCaretVisible((prev) => {
        const next = !prev;
        engine.updatePageEditState(activeElement.pageIndex, {
          activeElementId: activeElement.id,
          activeTextOverride: inputText,
          caretVisible: next,
        });
        return next;
      });
    }, 530);

    return () => clearInterval(timer);
  }, [activeElement, engine, inputText]);

  // 当当前激活元素改变时，同步更新隐藏式输入框内容
  useEffect(() => {
    if (activeElement) {
      setInputText(activeElement.text || '');
      // 延迟微任务聚焦，防止移动端或快捷键跳动
      setTimeout(() => {
        if (proxyInputRef.current) {
          proxyInputRef.current.focus();
          proxyInputRef.current.select();
        }
      }, 30);
    }
  }, [activeElement]);

  // 3. 鼠标在 3D 书本表面移动：高精度 3D 射线拾取与版式元素 Hover 判定
  const handleStageMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!engine) return;

      const coords = engine.getCanvasCoordsFromClient(e.clientX, e.clientY);
      if (!coords) {
        if (hoveredElementId && hoveredPageIndex !== null) {
          engine.updatePageEditState(hoveredPageIndex, {
            activeElementId: activeElement?.pageIndex === hoveredPageIndex ? activeElement.id : null,
            activeTextOverride: activeElement?.pageIndex === hoveredPageIndex ? inputText : undefined,
            caretVisible,
            hoveredElementId: null,
          });
          setHoveredElementId(null);
          setHoveredPageIndex(null);
        }
        return;
      }

      const page = pages[coords.pageIndex];
      if (!page) return;

      const elements = getPageLayoutElements(page, coords.pageIndex);
      const hit = findLayoutElementAtCoords(elements, coords.canvasX, coords.canvasY);

      if (hit) {
        if (hit.id !== hoveredElementId || coords.pageIndex !== hoveredPageIndex) {
          setHoveredElementId(hit.id);
          setHoveredPageIndex(coords.pageIndex);

          engine.updatePageEditState(coords.pageIndex, {
            activeElementId: activeElement?.pageIndex === coords.pageIndex ? activeElement.id : null,
            activeTextOverride: activeElement?.pageIndex === coords.pageIndex ? inputText : undefined,
            caretVisible,
            hoveredElementId: hit.id,
          });
        }
      } else {
        if (hoveredElementId) {
          engine.updatePageEditState(coords.pageIndex, {
            activeElementId: activeElement?.pageIndex === coords.pageIndex ? activeElement.id : null,
            activeTextOverride: activeElement?.pageIndex === coords.pageIndex ? inputText : undefined,
            caretVisible,
            hoveredElementId: null,
          });
          setHoveredElementId(null);
          setHoveredPageIndex(null);
        }
      }
    },
    [engine, pages, hoveredElementId, hoveredPageIndex, activeElement, inputText, caretVisible]
  );

  // 4. 鼠标点击 3D 书本：精准激活选中文本块，聚焦输入代理
  const handleStageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!engine) return;

      const coords = engine.getCanvasCoordsFromClient(e.clientX, e.clientY);
      if (!coords) {
        // 点击空白处取消选中
        if (activeElement) {
          engine.updatePageEditState(activeElement.pageIndex, null);
          setActiveElement(null);
        }
        return;
      }

      const page = pages[coords.pageIndex];
      if (!page) return;

      const elements = getPageLayoutElements(page, coords.pageIndex);
      const hit = findLayoutElementAtCoords(elements, coords.canvasX, coords.canvasY);

      if (hit) {
        // 清理旧激活页的状态
        if (activeElement && activeElement.pageIndex !== coords.pageIndex) {
          engine.updatePageEditState(activeElement.pageIndex, null);
        }

        setActiveElement(hit);
        setInputText(hit.text || '');
        setProxyPos({ x: e.clientX, y: e.clientY });

        // 原生 3D 材质热重绘
        engine.updatePageEditState(coords.pageIndex, {
          activeElementId: hit.id,
          activeTextOverride: hit.text || '',
          caretVisible: true,
          hoveredElementId: null,
        });

        // 如果命中的是朱砂印章，则同步打开印章面板
        if (hit.type === 'seal') {
          setCustomSealText(hit.text || '');
          setShowSealModal(true);
        }
      } else {
        if (activeElement) {
          engine.updatePageEditState(activeElement.pageIndex, null);
          setActiveElement(null);
        }
      }
    },
    [engine, pages, activeElement]
  );

  // 5. 键盘输入处理（完全支持中文拼音输入法 IME 与退格换行）
  const handleProxyInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!activeElement || !engine) return;

    // 即时在 3D 纸张纹理上渲染新文本
    engine.updatePageEditState(activeElement.pageIndex, {
      activeElementId: activeElement.id,
      activeTextOverride: val,
      caretVisible: true,
    });

    // 更新页面数据模型
    const pageIdx = activeElement.pageIndex;
    const page = pages[pageIdx];
    if (!page) return;

    const updatedPage: PageContent = { ...page };
    const elId = activeElement.id;

    if (elId === 'title') {
      updatedPage.title = val;
    } else if (elId === 'subtitle') {
      updatedPage.subtitle = val;
    } else if (elId === 'author') {
      updatedPage.author = val;
    } else if (elId === 'chapterNumber') {
      updatedPage.chapterNumber = val;
    } else if (elId === 'header') {
      updatedPage.headerText = val;
    } else if (elId === 'seal') {
      updatedPage.sealText = val;
    } else if (elId.startsWith('paragraph-')) {
      const pIdx = activeElement.paragraphIndex ?? 0;
      if (updatedPage.paragraphs && pIdx < updatedPage.paragraphs.length) {
        updatedPage.paragraphs = [...updatedPage.paragraphs];
        updatedPage.paragraphs[pIdx] = val;
      }
    } else if (elId.startsWith('poetry-')) {
      const pIdx = activeElement.poetryIndex ?? 0;
      if (updatedPage.poetryLines && pIdx < updatedPage.poetryLines.length) {
        updatedPage.poetryLines = [...updatedPage.poetryLines];
        updatedPage.poetryLines[pIdx] = val;
      }
    } else if (elId.startsWith('note-')) {
      const nIdx = activeElement.noteIndex ?? 0;
      if (updatedPage.notes && nIdx < updatedPage.notes.length) {
        updatedPage.notes = [...updatedPage.notes];
        updatedPage.notes[nIdx] = val;
      }
    } else if (elId.startsWith('toc-')) {
      const tIdx = activeElement.tocIndex ?? 0;
      if (updatedPage.tocItems && tIdx < updatedPage.tocItems.length) {
        updatedPage.tocItems = [...updatedPage.tocItems];
        updatedPage.tocItems[tIdx] = { ...updatedPage.tocItems[tIdx], title: val };
      }
    } else if (elId.startsWith('colophon-')) {
      const cIdx = activeElement.colophonIndex ?? 0;
      if (updatedPage.colophonDetails && cIdx < updatedPage.colophonDetails.length) {
        updatedPage.colophonDetails = [...updatedPage.colophonDetails];
        updatedPage.colophonDetails[cIdx] = { ...updatedPage.colophonDetails[cIdx], value: val };
      }
    }

    onUpdatePage(pageIdx, updatedPage);
  };

  const handleProxyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      if (activeElement && engine) {
        engine.updatePageEditState(activeElement.pageIndex, null);
        setActiveElement(null);
      }
    }
  };

  // 6. 快捷操作：新增段落
  const handleAddParagraph = () => {
    const pageIdx = activePageIndex;
    const page = pages[pageIdx];
    if (!page) return;

    const copy = [...(page.paragraphs || [])];
    const insertIdx = activeElement?.paragraphIndex !== undefined ? activeElement.paragraphIndex + 1 : copy.length;
    copy.splice(insertIdx, 0, '在此键入新的一段文字……');

    const updated = { ...page, paragraphs: copy };
    onUpdatePage(pageIdx, updated);

    // 重新聚焦新段落
    setTimeout(() => {
      if (engine) {
        engine.updatePageContent(pageIdx, updated);
        const elements = getPageLayoutElements(updated, pageIdx);
        const newEl = elements.find((e) => e.id === `paragraph-${insertIdx}`);
        if (newEl) {
          setActiveElement(newEl);
          setInputText(newEl.text);
          engine.updatePageEditState(pageIdx, {
            activeElementId: newEl.id,
            activeTextOverride: newEl.text,
            caretVisible: true,
          });
        }
      }
    }, 50);
  };

  // 7. 快捷操作：删除当前段落
  const handleDeleteParagraph = () => {
    if (!activeElement || activeElement.paragraphIndex === undefined) return;
    const pageIdx = activeElement.pageIndex;
    const page = pages[pageIdx];
    if (!page || !page.paragraphs || page.paragraphs.length <= 1) return;

    const copy = page.paragraphs.filter((_, i) => i !== activeElement.paragraphIndex);
    const updated = { ...page, paragraphs: copy };
    onUpdatePage(pageIdx, updated);

    if (engine) {
      engine.updatePageContent(pageIdx, updated);
      engine.updatePageEditState(pageIdx, null);
    }
    setActiveElement(null);
  };

  // 8. 朱砂印章快速刻印切换
  const handleSelectSeal = (seal: string) => {
    const pageIdx = activeElement ? activeElement.pageIndex : activePageIndex;
    const page = pages[pageIdx];
    if (!page) return;

    const updated = { ...page, sealText: seal };
    onUpdatePage(pageIdx, updated);

    if (engine) {
      engine.updatePageContent(pageIdx, updated);
      if (activeElement && activeElement.type === 'seal') {
        engine.updatePageEditState(pageIdx, {
          activeElementId: activeElement.id,
          activeTextOverride: seal,
          caretVisible: true,
        });
      }
    }
    setInputText(seal);
    setShowSealModal(false);
  };

  // 9. 导出与导入 JSON
  const handleExportJson = () => {
    const dataStr = JSON.stringify(pages, null, 2);
    navigator.clipboard?.writeText(dataStr);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paper-mono-book-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('导入的内容必须是包含书籍页面对象的 JSON 数组');
      }
      onImportPages(parsed);
      setShowImportModal(false);
      setImportJsonText('');
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'JSON 格式解析失败');
    }
  };

  return (
    <div
      onMouseMove={handleStageMouseMove}
      onClick={handleStageClick}
      className="absolute inset-0 size-full pointer-events-auto z-40 select-none"
      style={{
        cursor: hoveredElementId
          ? hoveredElementId === 'seal'
            ? 'pointer'
            : 'text'
          : 'default',
      }}
    >
      {/* 1. 隐藏式中文 IME 代理输入框 (Invisible Keyboard Proxy with IME Support) */}
      <textarea
        ref={proxyInputRef}
        value={inputText}
        onChange={handleProxyInputChange}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        onKeyDown={handleProxyKeyDown}
        aria-label="3D Paper Native Editor IME Proxy"
        tabIndex={-1}
        style={{
          position: 'fixed',
          top: `${proxyPos.y}px`,
          left: `${proxyPos.x}px`,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -10,
          caretColor: 'transparent',
          resize: 'none',
          outline: 'none',
          border: 'none',
        }}
      />

      {/* 2. 悬浮顶部极简 3D 原生排印编辑胶囊 (Sleek Floating Toolbar) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#E2DDD3] shadow-lg text-xs text-[#242220] whitespace-nowrap animate-in fade-in slide-in-from-top-2 font-serif pointer-events-auto">
        <div className="flex items-center gap-1.5 pr-2 border-r border-[#E2DDD3]">
          <span className="size-2 rounded-full bg-[#9B2D26] animate-pulse" />
          <span className="font-bold text-[#9B2D26]">原生 3D 排印</span>
          <span className="text-[#242220]/60 hidden sm:inline">
            · 无 HTML 盖层 · 墨入纸面
          </span>
        </div>

        {/* 翻页切换 */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (currentSheet > 0) onGoToSheet(currentSheet - 1);
            }}
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
              : `第 ${2 * currentSheet - 1}-${2 * currentSheet} 页`}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (currentSheet < totalSheets) onGoToSheet(currentSheet + 1);
            }}
            disabled={currentSheet >= totalSheets}
            className="p-1 hover:bg-black/5 disabled:opacity-30 rounded transition-colors"
            title="后一印张"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {/* 当前编辑状态提示 */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E2DDD3]/70 text-[11px] text-[#242220]/75">
          <Sparkles className="size-3 text-[#9B2D26]" />
          <span>
            {activeElement
              ? `正在编辑：第 ${activeElement.pageIndex + 1} 页 · ${activeElement.label}`
              : '点击 3D 页面任意文字即可直接打字修改'}
          </span>
        </div>

        {/* 针对正文段落的增删操作 */}
        {activeElement?.paragraphIndex !== undefined && (
          <div className="flex items-center gap-1 pl-1 border-l border-[#E2DDD3]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddParagraph();
              }}
              title="在当前段落后插入新段落"
              className="px-2 py-0.5 rounded bg-black/5 hover:bg-black/10 flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <Plus className="size-3 text-[#9B2D26]" />
              <span>加段</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteParagraph();
              }}
              title="删除当前选中的段落"
              className="p-1 text-red-700 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}

        {/* 朱砂印章刻印入口 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSealModal((p) => !p);
          }}
          title="切换朱砂印章刻印文字"
          className="p-1 rounded hover:bg-black/5 text-[#9B2D26] transition-colors"
        >
          <Stamp className="size-3.5" />
        </button>

        {/* 重置本页 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onResetPage(activePageIndex);
          }}
          title="重置当前页为初始文本"
          className="p-1 rounded hover:bg-black/5 transition-colors"
        >
          <RotateCcw className="size-3.5" />
        </button>

        {/* 导出 JSON */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleExportJson();
          }}
          title="导出整本杂志书籍数据 (JSON)"
          className="p-1 rounded hover:bg-black/5 transition-colors"
        >
          <Download className="size-3.5" />
        </button>

        {/* 导入 JSON */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowImportModal(true);
          }}
          title="导入自定义杂志书籍数据 (JSON)"
          className="p-1 rounded hover:bg-black/5 transition-colors"
        >
          <Upload className="size-3.5" />
        </button>

        {/* 完成退出编辑 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCloseEditMode();
          }}
          className="ml-1 px-3 py-1 rounded-full bg-[#9B2D26] hover:bg-[#85251F] text-white font-medium flex items-center gap-1 shadow-xs transition-colors"
        >
          <Check className="size-3" />
          <span>完成</span>
        </button>
      </div>

      {/* 3. 朱砂印章快速刻印弹窗 (Stamp Selector Modal) */}
      {showSealModal && (
        <div
          onClick={(e) => e.stopPropagation()}
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

          <div className="text-xs text-[#242220]/70 mb-1">自定义刻印 (2或4字)：</div>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={4}
              value={customSealText}
              onChange={(e) => setCustomSealText(e.target.value)}
              placeholder="如：澄怀观道"
              className="flex-1 px-2.5 py-1 text-sm border border-[#E2DDD3] rounded bg-white outline-none focus:ring-1 focus:ring-[#9B2D26]"
            />
            <button
              onClick={() => {
                if (customSealText.trim()) {
                  handleSelectSeal(customSealText.trim());
                }
              }}
              className="px-3 py-1 bg-[#9B2D26] hover:bg-[#85251F] text-white text-xs font-bold rounded shadow-xs"
            >
              盖印
            </button>
          </div>
        </div>
      )}

      {/* 4. JSON 导入模态弹窗 (Import JSON Modal) */}
      {showImportModal && (
        <div
          onClick={(e) => e.stopPropagation()}
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
                可粘贴此前导出的整书 JSON 配置。提交后 3D 页面将全量重绘更新。
              </p>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
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
