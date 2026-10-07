import React, { useState } from 'react';
import { PageContent, CHINESE_PAGES } from './chinesePublicationData';
import {
  X,
  RotateCcw,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';

export interface PageEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pages: PageContent[];
  activePageIndex: number;
  onSelectPageIndex: (index: number) => void;
  onUpdatePage: (index: number, newPage: PageContent) => void;
  onResetPage: (index: number) => void;
  onResetAll: () => void;
  onGoToPage: (index: number) => void;
  onImportPages: (newPages: PageContent[]) => void;
}

const PAGE_TYPE_LABELS: Record<PageContent['type'], string> = {
  cover: '封面书衣',
  frontispiece: '扉页题记',
  toc: '目录目次',
  chapter: '章节题扉',
  spread: '散文正文',
  poetry: '诗歌居中',
  colophon: '底封版权',
};

export const PageEditorDrawer: React.FC<PageEditorDrawerProps> = ({
  isOpen,
  onClose,
  pages,
  activePageIndex,
  onSelectPageIndex,
  onUpdatePage,
  onResetPage,
  onResetAll,
  onGoToPage,
  onImportPages,
}) => {
  const [copied, setCopied] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');

  if (!isOpen) return null;

  const currentPage = pages[activePageIndex] || pages[0];

  const updateCurrentField = <K extends keyof PageContent>(
    key: K,
    val: PageContent[K]
  ) => {
    const updated: PageContent = {
      ...currentPage,
      [key]: val,
    };
    onUpdatePage(activePageIndex, updated);
  };

  const handleParagraphsChange = (text: string) => {
    const arr = text.split('\n').filter((line) => line.trim().length > 0);
    updateCurrentField('paragraphs', arr);
  };

  const handlePoetryChange = (text: string) => {
    const lines = text.split('\n');
    updateCurrentField('poetryLines', lines);
  };

  const handleNotesChange = (text: string) => {
    const arr = text.split('\n').filter((line) => line.trim().length > 0);
    updateCurrentField('notes', arr);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(pages, null, 2);
    navigator.clipboard?.writeText(dataStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wenxin-publication-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyImport = () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('导入的内容必须是包含页面对象的 JSON 数组');
      }
      onImportPages(parsed);
      setShowImportModal(false);
      setImportJsonText('');
    } catch (err: any) {
      setImportError(err.message || 'JSON 解析失败，请检查格式');
    }
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 w-full sm:w-[420px] bg-[#FAF8F5] border-r border-[#E2DDD3] shadow-2xl flex flex-col font-serif select-text transition-transform duration-300 animate-in slide-in-from-left"
      style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
    >
      {/* 顶栏控制 */}
      <div className="shrink-0 px-4 py-3 border-b border-[#E2DDD3] bg-[#F4F0E8] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-5 rounded bg-[#9B2D26] text-white flex items-center justify-center text-xs font-bold">
            编
          </span>
          <span className="font-bold text-sm tracking-wide text-[#242220]">
            页面动态排印编辑
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#9B2D26]/10 text-[#9B2D26] font-medium">
            实时 3D 同步
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-black/10 text-[#242220]/70 hover:text-[#242220] transition-colors cursor-pointer"
          title="退出编辑模式"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 页面快速选择器 */}
      <div className="shrink-0 px-4 py-2.5 bg-[#FAF8F5] border-b border-[#E8E4DC] flex items-center gap-2">
        <button
          disabled={activePageIndex === 0}
          onClick={() => {
            const nextIdx = Math.max(0, activePageIndex - 1);
            onSelectPageIndex(nextIdx);
            onGoToPage(nextIdx);
          }}
          className="p-1.5 rounded bg-white hover:bg-[#F2ECE1] disabled:opacity-30 disabled:pointer-events-none border border-[#E2DDD3] text-[#242220] transition-colors cursor-pointer"
          title="上一页"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        <select
          value={activePageIndex}
          onChange={(e) => {
            const idx = Number(e.target.value);
            onSelectPageIndex(idx);
            onGoToPage(idx);
          }}
          className="flex-1 h-8 px-2.5 rounded bg-white border border-[#E2DDD3] text-xs text-[#242220] focus:outline-none focus:border-[#9B2D26] transition-colors cursor-pointer font-serif"
        >
          {pages.map((p, idx) => (
            <option key={idx} value={idx}>
              第 {idx + 1} 页 · {PAGE_TYPE_LABELS[p.type] || p.type}：{p.title || '（未命名）'}
            </option>
          ))}
        </select>

        <button
          disabled={activePageIndex === pages.length - 1}
          onClick={() => {
            const nextIdx = Math.min(pages.length - 1, activePageIndex + 1);
            onSelectPageIndex(nextIdx);
            onGoToPage(nextIdx);
          }}
          className="p-1.5 rounded bg-white hover:bg-[#F2ECE1] disabled:opacity-30 disabled:pointer-events-none border border-[#E2DDD3] text-[#242220] transition-colors cursor-pointer"
          title="下一页"
        >
          <ChevronRight className="size-3.5" />
        </button>

        <button
          onClick={() => onGoToPage(activePageIndex)}
          className="px-2 h-8 rounded bg-[#9B2D26] hover:bg-[#83251F] text-white text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
          title="翻至当前编辑页查看 3D 效果"
        >
          <BookOpen className="size-3.5" />
          <span>翻阅</span>
        </button>
      </div>

      {/* 表单滚动主体 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs text-[#242220]">
        {/* 版式类型与重置 */}
        <div className="flex items-center justify-between pb-1 border-b border-[#E8E4DC]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#242220]/60">版式结构:</span>
            <select
              value={currentPage.type}
              onChange={(e) =>
                updateCurrentField('type', e.target.value as PageContent['type'])
              }
              className="h-6 px-2 rounded bg-white border border-[#E2DDD3] text-xs font-medium text-[#9B2D26] focus:outline-none focus:border-[#9B2D26] cursor-pointer"
            >
              <option value="cover">封面书衣</option>
              <option value="frontispiece">扉页题记</option>
              <option value="toc">目录目次</option>
              <option value="chapter">章节题扉</option>
              <option value="spread">散文正文</option>
              <option value="poetry">诗歌居中</option>
              <option value="colophon">底封版权</option>
            </select>
          </div>

          <button
            onClick={() => onResetPage(activePageIndex)}
            className="inline-flex items-center gap-1 text-[11px] text-[#242220]/60 hover:text-[#9B2D26] transition-colors cursor-pointer"
            title="恢复当前页初始典藏文案"
          >
            <RotateCcw className="size-3" />
            <span>恢复默认</span>
          </button>
        </div>

        {/* 标题 */}
        <div>
          <label className="block text-[11px] font-bold text-[#242220]/80 mb-1">
            页面主标题 (Title)
          </label>
          <input
            type="text"
            value={currentPage.title || ''}
            onChange={(e) => updateCurrentField('title', e.target.value)}
            placeholder="例如：文心雅集、前赤壁赋、目次..."
            className="w-full h-8 px-2.5 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] transition-colors"
          />
        </div>

        {/* 副标题 */}
        <div>
          <label className="block text-[11px] font-bold text-[#242220]/80 mb-1">
            副标题 / 题注 (Subtitle)
          </label>
          <input
            type="text"
            value={currentPage.subtitle || ''}
            onChange={(e) => updateCurrentField('subtitle', e.target.value)}
            placeholder="例如：名家散文与经典文论排印选粹..."
            className="w-full h-8 px-2.5 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] transition-colors"
          />
        </div>

        {/* 作者 / 编者 */}
        {currentPage.type !== 'toc' && currentPage.type !== 'colophon' && (
          <div>
            <label className="block text-[11px] font-bold text-[#242220]/80 mb-1">
              著者 / 编者 (Author)
            </label>
            <input
              type="text"
              value={currentPage.author || ''}
              onChange={(e) => updateCurrentField('author', e.target.value)}
              placeholder="例如：〔宋〕苏 轼、朱自清、林徽因..."
              className="w-full h-8 px-2.5 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] transition-colors"
            />
          </div>
        )}

        {/* 章节号 (仅 chapter 类型有效) */}
        {currentPage.type === 'chapter' && (
          <div>
            <label className="block text-[11px] font-bold text-[#242220]/80 mb-1">
              卷次 / 篇序 (Chapter Number)
            </label>
            <input
              type="text"
              value={currentPage.chapterNumber || ''}
              onChange={(e) => updateCurrentField('chapterNumber', e.target.value)}
              placeholder="例如：卷一 · 前赤壁赋..."
              className="w-full h-8 px-2.5 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] transition-colors"
            />
          </div>
        )}

        {/* 书眉页眉 (Header Text) */}
        {currentPage.type !== 'cover' && currentPage.type !== 'colophon' && (
          <div>
            <label className="block text-[11px] font-bold text-[#242220]/80 mb-1">
              书眉横栏 (Running Header)
            </label>
            <input
              type="text"
              value={currentPage.headerText || ''}
              onChange={(e) => updateCurrentField('headerText', e.target.value)}
              placeholder="例如：文心雅集 · 卷一 前赤壁赋..."
              className="w-full h-8 px-2.5 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] transition-colors"
            />
          </div>
        )}

        {/* 朱砂印章 (Seal Text) */}
        {currentPage.sealText !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-[#242220]/80">
                朱砂印章文字 (Seal Stamp)
              </label>
              <div className="flex items-center gap-1.5 text-[11px] text-[#9B2D26]">
                <span className="size-4 border border-[#9B2D26] flex items-center justify-center text-[9px] font-bold">
                  {currentPage.sealText.slice(0, 2)}
                </span>
                <span>印章预览</span>
              </div>
            </div>
            <input
              type="text"
              maxLength={4}
              value={currentPage.sealText || ''}
              onChange={(e) => updateCurrentField('sealText', e.target.value)}
              placeholder="建议 2 或 4 个汉字，如：文心、雅趣、典藏..."
              className="w-full h-8 px-2.5 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] transition-colors"
            />
          </div>
        )}

        {/* 目录项编辑 (仅 toc 类型) */}
        {currentPage.type === 'toc' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#242220]/80">
                目录条目列表
              </label>
              <button
                onClick={() => {
                  const currentItems = currentPage.tocItems || [];
                  updateCurrentField('tocItems', [
                    ...currentItems,
                    { title: '新增篇目', author: '著者', page: '00' },
                  ]);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-[#9B2D26] hover:underline cursor-pointer"
              >
                <Plus className="size-3" />
                <span>添加条目</span>
              </button>
            </div>

            {(currentPage.tocItems || []).map((item, idx) => (
              <div
                key={idx}
                className="p-2 rounded bg-white border border-[#E2DDD3] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const list = [...(currentPage.tocItems || [])];
                    list[idx] = { ...list[idx], title: e.target.value };
                    updateCurrentField('tocItems', list);
                  }}
                  placeholder="篇名"
                  className="flex-2 h-7 px-2 rounded bg-[#FAF8F5] border border-[#E2DDD3] text-xs"
                />
                <input
                  type="text"
                  value={item.author}
                  onChange={(e) => {
                    const list = [...(currentPage.tocItems || [])];
                    list[idx] = { ...list[idx], author: e.target.value };
                    updateCurrentField('tocItems', list);
                  }}
                  placeholder="作者"
                  className="flex-1 h-7 px-2 rounded bg-[#FAF8F5] border border-[#E2DDD3] text-xs"
                />
                <input
                  type="text"
                  value={item.page}
                  onChange={(e) => {
                    const list = [...(currentPage.tocItems || [])];
                    list[idx] = { ...list[idx], page: e.target.value };
                    updateCurrentField('tocItems', list);
                  }}
                  placeholder="页码"
                  className="w-10 h-7 px-1.5 text-center rounded bg-[#FAF8F5] border border-[#E2DDD3] text-xs"
                />
                <button
                  onClick={() => {
                    const list = (currentPage.tocItems || []).filter((_, i) => i !== idx);
                    updateCurrentField('tocItems', list);
                  }}
                  className="p-1 text-red-500/70 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 诗歌行编辑 (仅 poetry 类型) */}
        {currentPage.type === 'poetry' && (
          <div>
            <label className="block text-[11px] font-bold text-[#242220]/80 mb-1">
              诗歌行（每换一行对应一行居中诗句，空行代表节落空行）
            </label>
            <textarea
              rows={10}
              value={(currentPage.poetryLines || []).join('\n')}
              onChange={(e) => handlePoetryChange(e.target.value)}
              placeholder="输入诗句，每行一句..."
              className="w-full p-2.5 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] leading-relaxed transition-colors font-mono"
            />
          </div>
        )}

        {/* 版权信息编辑 (仅 colophon 类型) */}
        {currentPage.type === 'colophon' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#242220]/80">
                CIP 版权信息明细
              </label>
              <button
                onClick={() => {
                  const currentDetails = currentPage.colophonDetails || [];
                  updateCurrentField('colophonDetails', [
                    ...currentDetails,
                    { key: '新增项', value: '详情说明' },
                  ]);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-[#9B2D26] hover:underline cursor-pointer"
              >
                <Plus className="size-3" />
                <span>添加项目</span>
              </button>
            </div>

            {(currentPage.colophonDetails || []).map((detail, idx) => (
              <div
                key={idx}
                className="p-2 rounded bg-white border border-[#E2DDD3] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={detail.key}
                  onChange={(e) => {
                    const list = [...(currentPage.colophonDetails || [])];
                    list[idx] = { ...list[idx], key: e.target.value };
                    updateCurrentField('colophonDetails', list);
                  }}
                  placeholder="项目名称"
                  className="w-24 h-7 px-2 rounded bg-[#FAF8F5] border border-[#E2DDD3] text-xs font-bold"
                />
                <input
                  type="text"
                  value={detail.value}
                  onChange={(e) => {
                    const list = [...(currentPage.colophonDetails || [])];
                    list[idx] = { ...list[idx], value: e.target.value };
                    updateCurrentField('colophonDetails', list);
                  }}
                  placeholder="项目内容"
                  className="flex-1 h-7 px-2 rounded bg-[#FAF8F5] border border-[#E2DDD3] text-xs"
                />
                <button
                  onClick={() => {
                    const list = (currentPage.colophonDetails || []).filter((_, i) => i !== idx);
                    updateCurrentField('colophonDetails', list);
                  }}
                  className="p-1 text-red-500/70 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 正文段落编辑 (除 cover, toc, poetry, colophon 以外) */}
        {currentPage.type !== 'cover' &&
          currentPage.type !== 'toc' &&
          currentPage.type !== 'poetry' &&
          currentPage.type !== 'colophon' && (
            <div>
              <label className="block text-[11px] font-bold text-[#242220]/80 mb-1">
                正文段落（按回车换行自动分段，排印时自动缩进两字符）
              </label>
              <textarea
                rows={9}
                value={(currentPage.paragraphs || []).join('\n\n')}
                onChange={(e) => handleParagraphsChange(e.target.value)}
                placeholder="输入正文内容，段落之间空一行..."
                className="w-full p-2.5 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] leading-relaxed transition-colors"
              />
            </div>
          )}

        {/* 底部旁注 / 注释 (仅普通正文) */}
        {(currentPage.type === 'spread' || currentPage.type === 'chapter') && (
          <div>
            <label className="block text-[11px] font-bold text-[#242220]/80 mb-1">
              页脚小注 / 注释 (Notes，每行一条)
            </label>
            <textarea
              rows={3}
              value={(currentPage.notes || []).join('\n')}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="例如：〔字阶准则〕标题一般按倍率递减..."
              className="w-full p-2 rounded bg-white border border-[#E2DDD3] focus:outline-none focus:border-[#9B2D26] leading-relaxed transition-colors text-[11px]"
            />
          </div>
        )}
      </div>

      {/* 底部全书级操作栏 */}
      <div className="shrink-0 p-3 bg-[#F4F0E8] border-t border-[#E2DDD3] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportJson}
            className="px-2.5 py-1.5 rounded bg-white hover:bg-[#FAF8F5] border border-[#E2DDD3] text-[#242220] flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            title="导出整本书籍为 JSON 文件并复制"
          >
            {copied ? <Check className="size-3.5 text-green-600" /> : <Download className="size-3.5" />}
            <span>{copied ? '已复制' : '导出全书'}</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-2.5 py-1.5 rounded bg-white hover:bg-[#FAF8F5] border border-[#E2DDD3] text-[#242220] flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            title="导入自定义 JSON 书本配置"
          >
            <Upload className="size-3.5" />
            <span>导入全书</span>
          </button>
        </div>

        <button
          onClick={onResetAll}
          className="px-2 py-1.5 text-[11px] text-[#242220]/60 hover:text-red-700 transition-colors cursor-pointer"
          title="将整本书 16 页全部恢复为经典初版"
        >
          全书还原
        </button>
      </div>

      {/* 导入 JSON 模态窗 */}
      {showImportModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#FAF8F5] rounded-xl border border-[#E2DDD3] shadow-2xl p-5 flex flex-col gap-3 font-serif">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#242220]">
                导入全书 JSON 配置文件
              </span>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded hover:bg-black/10 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-[#242220]/60">
              请在此处黏贴导出的全书 JSON 数组，导入后将立刻更新 3D 翻页书的全部页面。
            </p>

            <textarea
              rows={10}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="在此处黏贴 JSON 内容..."
              className="w-full p-2.5 rounded bg-white border border-[#E2DDD3] text-xs font-mono focus:outline-none focus:border-[#9B2D26]"
            />

            {importError && (
              <p className="text-xs text-red-600 font-sans">{importError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 rounded bg-white border border-[#E2DDD3] text-xs cursor-pointer hover:bg-black/5"
              >
                取消
              </button>
              <button
                onClick={handleApplyImport}
                className="px-4 py-1.5 rounded bg-[#9B2D26] text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-[#83251F]"
              >
                确认导入并应用
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
