import React, { useState, useRef, useEffect } from 'react';
import { PageContent, CHINESE_PAGES } from './chinesePublicationData';
import {
  Check,
  X,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export interface InPage3DEditorProps {
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
  onGoToSheet: (sheetIndex: number) => void;
  onCloseEditMode: () => void;
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

// 预设朱砂印章候选
const PRESET_SEALS = ['文心典藏', '文心雅集', '雅趣', '慎独', '苏轼', '朱自清', '林徽因', '金石', '读思'];

export const InPage3DEditor: React.FC<InPage3DEditorProps> = ({
  stageWidth,
  stageHeight,
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
  const [activeSide, setActiveSide] = useState<'left' | 'right'>(
    rightPageNum !== null ? 'right' : 'left'
  );
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');
  const [sealPopoverPageIdx, setSealPopoverPageIdx] = useState<number | null>(null);

  // 当翻页时，保持聚焦有效页面
  useEffect(() => {
    if (activeSide === 'left' && leftPageNum === null && rightPageNum !== null) {
      setActiveSide('right');
    } else if (activeSide === 'right' && rightPageNum === null && leftPageNum !== null) {
      setActiveSide('left');
    }
  }, [leftPageNum, rightPageNum, activeSide]);

  // 1440 * 1983 标准出版物画幅到当前 3D 书籍单页尺寸的等比缩放率
  const singlePageW = stageWidth / 2;
  const singlePageH = stageHeight;
  const scaleX = singlePageW / 1440;
  const scaleY = singlePageH / 1983;

  const activePageNum = activeSide === 'left' ? leftPageNum : rightPageNum;
  const activePageIdx = activePageNum !== null ? activePageNum - 1 : 0;
  const activePage = pages[activePageIdx] || pages[0];

  const handleUpdateActiveField = <K extends keyof PageContent>(
    key: K,
    val: PageContent[K]
  ) => {
    if (activePageIdx === null || activePageIdx < 0 || activePageIdx >= pages.length) return;
    const updated: PageContent = {
      ...activePage,
      [key]: val,
    };
    onUpdatePage(activePageIdx, updated);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(pages, null, 2);
    navigator.clipboard?.writeText(dataStr);
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
        throw new Error('导入的内容必须是包含 16 页页面对象的 JSON 数组');
      }
      onImportPages(parsed);
      setShowImportModal(false);
      setImportJsonText('');
    } catch (err: any) {
      setImportError(err.message || 'JSON 格式解析错误');
    }
  };

  // 单页视图渲染器
  const renderSinglePageOverlay = (
    pageNum: number | null,
    side: 'left' | 'right'
  ) => {
    if (pageNum === null) return null;
    const pageIdx = pageNum - 1;
    const page = pages[pageIdx];
    if (!page) return null;

    const isLeft = side === 'left';
    const spineMargin = 150;
    const outerMargin = 160;
    const contentLeft = isLeft ? outerMargin : spineMargin;
    const contentRight = isLeft ? 1440 - spineMargin : 1440 - outerMargin;
    const contentWidth = contentRight - contentLeft;

    const updateField = <K extends keyof PageContent>(key: K, val: PageContent[K]) => {
      const updated: PageContent = { ...page, [key]: val };
      onUpdatePage(pageIdx, updated);
    };

    return (
      <div
        key={`${side}-${pageIdx}`}
        onClick={() => setActiveSide(side)}
        style={{
          position: 'absolute',
          left: isLeft ? 0 : '50%',
          top: 0,
          width: '1440px',
          height: '1983px',
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
          fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif',
        }}
        className={`select-text transition-shadow duration-200 ${
          activeSide === side ? 'ring-2 ring-[#9B2D26]/30' : ''
        }`}
      >
        {/* 书眉 (Running Header) */}
        {page.type !== 'cover' && page.type !== 'colophon' && (
          <div
            style={{
              position: 'absolute',
              top: '90px',
              left: `${contentLeft}px`,
              width: `${contentWidth}px`,
              height: '52px',
            }}
            className="flex flex-col justify-end border-b border-[#242220]/20"
          >
            <input
              type="text"
              value={page.headerText || ''}
              onChange={(e) => updateField('headerText', e.target.value)}
              placeholder="点击编辑书眉横栏..."
              style={{
                fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif',
                textAlign: isLeft ? 'left' : 'right',
              }}
              className="w-full text-[24px] text-[#242220]/75 bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-1.5 py-0.5 outline-none transition-all placeholder:text-[#242220]/25"
            />
          </div>
        )}

        {/* 页码 (Folio) */}
        {page.type !== 'cover' && (
          <div
            style={{
              position: 'absolute',
              top: '1863px',
              left: `${contentLeft}px`,
              width: `${contentWidth}px`,
              textAlign: isLeft ? 'left' : 'right',
            }}
            className="text-[24px] text-[#242220]/50 tracking-widest font-mono pointer-events-none select-none"
          >
            — {page.sideIndex.toString().padStart(2, '0')} —
          </div>
        )}

        {/* 1. 封面特别渲染 */}
        {page.type === 'cover' && (
          <div className="relative size-full p-[60px]">
            {/* 封套外框线 */}
            <div className="size-full border-[3px] border-[#9B2D26]/40 p-[12px]">
              <div className="size-full border border-[#9B2D26]/20 relative">
                {/* 传统中式题签框（靠右偏上） */}
                <div
                  style={{
                    position: 'absolute',
                    top: '148px',
                    right: '180px',
                    width: '160px',
                    height: '820px',
                  }}
                  className="bg-white/95 border-[3px] border-[#9B2D26] p-2 flex flex-col justify-between items-center shadow-sm"
                >
                  <div className="size-full border border-[#9B2D26] p-4 flex flex-col justify-between items-center">
                    <textarea
                      rows={6}
                      value={page.title.split('').join('\n')}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\n/g, '');
                        updateField('title', clean);
                      }}
                      title="点击直接修改书名（每字一行竖排）"
                      style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                      className="w-full text-center text-[68px] font-bold text-[#1D1A18] leading-[88px] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded outline-none resize-none overflow-hidden"
                    />
                    <input
                      type="text"
                      value={page.author || '文心选本'}
                      onChange={(e) => updateField('author', e.target.value)}
                      style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                      className="w-full text-center text-[26px] font-medium text-[#242220]/75 bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded outline-none"
                    />
                  </div>
                </div>

                {/* 封面副标题与署名（横排于左侧） */}
                <div
                  style={{
                    position: 'absolute',
                    top: '600px',
                    left: '160px',
                    width: '600px',
                  }}
                  className="space-y-6"
                >
                  <input
                    type="text"
                    value={page.subtitle || ''}
                    onChange={(e) => updateField('subtitle', e.target.value)}
                    placeholder="点击编辑副标题..."
                    style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                    className="w-full text-[34px] font-medium text-[#242220]/85 bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 py-1 outline-none"
                  />

                  {/* 印章点击编辑 */}
                  <div className="pt-4 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setSealPopoverPageIdx(sealPopoverPageIdx === pageIdx ? null : pageIdx)
                      }
                      title="点击编辑朱砂印章"
                      className="size-[84px] border-[3.5px] border-[#9B2D26] text-[#9B2D26] flex items-center justify-center font-bold text-[32px] hover:scale-105 active:scale-95 transition-transform bg-[#FAF8F5]/80 shadow-xs cursor-pointer"
                    >
                      {page.sealText || '文心'}
                    </button>
                    <span className="text-[20px] text-[#9B2D26]/70">
                      ← 点击印章可更换字样
                    </span>
                  </div>
                </div>

                {/* 底部出版局 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '80px',
                    left: 0,
                    width: '100%',
                    textAlign: 'center',
                  }}
                  className="text-[28px] font-bold text-[#242220]/70 tracking-[12px]"
                >
                  文 心 出 版 局
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. 扉页题记 */}
        {page.type === 'frontispiece' && (
          <div
            style={{
              position: 'absolute',
              top: '360px',
              left: `${contentLeft}px`,
              width: `${contentWidth}px`,
            }}
            className="flex flex-col items-center space-y-8"
          >
            <input
              type="text"
              value={page.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="扉页标题..."
              style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
              className="w-full text-center text-[54px] font-bold text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 py-1 outline-none"
            />
            {page.subtitle !== undefined && (
              <input
                type="text"
                value={page.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="扉页副标题..."
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-center text-[28px] text-[#242220]/65 bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 py-1 outline-none"
              />
            )}

            <div className="w-[840px] pt-8 space-y-6">
              {(page.paragraphs || []).map((p, pIdx) => (
                <div key={pIdx} className="group relative">
                  <textarea
                    rows={Math.max(2, Math.ceil(p.length / 24))}
                    value={p}
                    onChange={(e) => {
                      const copy = [...(page.paragraphs || [])];
                      copy[pIdx] = e.target.value;
                      updateField('paragraphs', copy);
                    }}
                    style={{
                      fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif',
                      textIndent: '2em',
                    }}
                    className="w-full text-[32px] text-[#242220] leading-[58px] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded p-2 outline-none resize-none"
                  />
                  <button
                    onClick={() => {
                      const copy = (page.paragraphs || []).filter((_, i) => i !== pIdx);
                      updateField('paragraphs', copy);
                    }}
                    title="删除此段"
                    className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => {
                  const copy = [...(page.paragraphs || []), '在此输入新段落内容...'];
                  updateField('paragraphs', copy);
                }}
                className="inline-flex items-center gap-2 text-[22px] text-[#9B2D26] hover:bg-[#9B2D26]/10 px-3 py-1.5 rounded cursor-pointer transition-colors"
              >
                <Plus className="size-5" />
                <span>添加题记段落</span>
              </button>
            </div>

            {/* 印章 */}
            {page.sealText !== undefined && (
              <div className="pt-6">
                <button
                  type="button"
                  onClick={() =>
                    setSealPopoverPageIdx(sealPopoverPageIdx === pageIdx ? null : pageIdx)
                  }
                  title="点击编辑朱砂印章"
                  className="size-[68px] border-[3.5px] border-[#9B2D26] text-[#9B2D26] flex items-center justify-center font-bold text-[26px] hover:scale-105 active:scale-95 transition-transform bg-[#FAF8F5]/80 shadow-xs cursor-pointer"
                >
                  {page.sealText}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. 目录目次 */}
        {page.type === 'toc' && (
          <div
            style={{
              position: 'absolute',
              top: '200px',
              left: `${contentLeft}px`,
              width: `${contentWidth}px`,
            }}
            className="space-y-6"
          >
            <div className="flex flex-col items-center">
              <input
                type="text"
                value={page.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="text-center text-[56px] font-bold text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-3 py-1 outline-none"
              />
              <input
                type="text"
                value={page.subtitle || ''}
                onChange={(e) => updateField('subtitle', e.target.value)}
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="text-center text-[22px] text-[#242220]/50 tracking-wider bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-3 py-0.5 outline-none"
              />
              <div className="w-[160px] h-[2px] bg-[#9B2D26] mt-4 mb-8" />
            </div>

            {/* 目录列表 */}
            <div className="space-y-4">
              {(page.tocItems || []).map((item, tIdx) => (
                <div
                  key={tIdx}
                  className="group flex items-center gap-3 p-2 rounded hover:bg-black/5 transition-colors"
                >
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const copy = [...(page.tocItems || [])];
                      copy[tIdx] = { ...copy[tIdx], title: e.target.value };
                      updateField('tocItems', copy);
                    }}
                    placeholder="篇名"
                    style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                    className="flex-3 text-[32px] font-medium text-[#242220] bg-transparent focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
                  />
                  <input
                    type="text"
                    value={item.author}
                    onChange={(e) => {
                      const copy = [...(page.tocItems || [])];
                      copy[tIdx] = { ...copy[tIdx], author: e.target.value };
                      updateField('tocItems', copy);
                    }}
                    placeholder="作者"
                    style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                    className="flex-2 text-[24px] text-[#242220]/65 bg-transparent focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
                  />
                  <input
                    type="text"
                    value={item.page}
                    onChange={(e) => {
                      const copy = [...(page.tocItems || [])];
                      copy[tIdx] = { ...copy[tIdx], page: e.target.value };
                      updateField('tocItems', copy);
                    }}
                    placeholder="页码"
                    style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                    className="w-16 text-right text-[28px] font-bold text-[#242220] bg-transparent focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-1 outline-none"
                  />
                  <button
                    onClick={() => {
                      const copy = (page.tocItems || []).filter((_, i) => i !== tIdx);
                      updateField('tocItems', copy);
                    }}
                    title="删除篇目"
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => {
                  const copy = [
                    ...(page.tocItems || []),
                    { title: '新增篇目', author: '著者', page: '00' },
                  ];
                  updateField('tocItems', copy);
                }}
                className="inline-flex items-center gap-2 text-[22px] text-[#9B2D26] hover:bg-[#9B2D26]/10 px-3 py-1.5 rounded cursor-pointer transition-colors"
              >
                <Plus className="size-5" />
                <span>添加目录篇目</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. 章节扉页 (Chapter) */}
        {page.type === 'chapter' && (
          <div
            style={{
              position: 'absolute',
              top: '380px',
              left: `${contentLeft}px`,
              width: `${contentWidth}px`,
            }}
            className="flex flex-col items-center space-y-6"
          >
            {page.chapterNumber !== undefined && (
              <input
                type="text"
                value={page.chapterNumber}
                onChange={(e) => updateField('chapterNumber', e.target.value)}
                placeholder="卷次..."
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-center text-[32px] font-bold text-[#9B2D26] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
              />
            )}
            <input
              type="text"
              value={page.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="章节大标题..."
              style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
              className="w-full text-center text-[64px] font-bold text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
            />
            {page.subtitle && (
              <input
                type="text"
                value={page.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="章节副题..."
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-center text-[28px] text-[#242220]/60 bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
              />
            )}
            {page.author && (
              <input
                type="text"
                value={page.author}
                onChange={(e) => updateField('author', e.target.value)}
                placeholder="著者..."
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-center text-[30px] font-medium text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
              />
            )}

            <div className="w-[780px] pt-8 space-y-4">
              {(page.paragraphs || []).map((p, pIdx) => (
                <div key={pIdx} className="group relative">
                  <textarea
                    rows={Math.max(2, Math.ceil(p.length / 24))}
                    value={p}
                    onChange={(e) => {
                      const copy = [...(page.paragraphs || [])];
                      copy[pIdx] = e.target.value;
                      updateField('paragraphs', copy);
                    }}
                    style={{
                      fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif',
                      textIndent: '2em',
                    }}
                    className="w-full text-[30px] text-[#242220]/85 leading-[56px] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded p-2 outline-none resize-none"
                  />
                  <button
                    onClick={() => {
                      const copy = (page.paragraphs || []).filter((_, i) => i !== pIdx);
                      updateField('paragraphs', copy);
                    }}
                    title="删除此段"
                    className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              ))}
            </div>

            {page.sealText !== undefined && (
              <div className="pt-6">
                <button
                  type="button"
                  onClick={() =>
                    setSealPopoverPageIdx(sealPopoverPageIdx === pageIdx ? null : pageIdx)
                  }
                  title="点击编辑朱砂印章"
                  className="size-[72px] border-[3.5px] border-[#9B2D26] text-[#9B2D26] flex items-center justify-center font-bold text-[28px] hover:scale-105 active:scale-95 transition-transform bg-[#FAF8F5]/80 shadow-xs cursor-pointer"
                >
                  {page.sealText}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. 居中诗歌页 (Poetry) */}
        {page.type === 'poetry' && (
          <div
            style={{
              position: 'absolute',
              top: '220px',
              left: `${contentLeft}px`,
              width: `${contentWidth}px`,
            }}
            className="flex flex-col items-center space-y-4"
          >
            <input
              type="text"
              value={page.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="诗歌标题..."
              style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
              className="w-full text-center text-[48px] font-bold text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
            />
            {page.subtitle && (
              <input
                type="text"
                value={page.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="诗歌题注..."
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-center text-[26px] text-[#242220]/60 bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
              />
            )}
            {page.author && (
              <input
                type="text"
                value={page.author}
                onChange={(e) => updateField('author', e.target.value)}
                placeholder="诗人..."
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-center text-[28px] text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 outline-none"
              />
            )}

            <div className="w-[840px] pt-8 space-y-2">
              {(page.poetryLines || []).map((line, lIdx) => (
                <div key={lIdx} className="group relative flex items-center">
                  <input
                    type="text"
                    value={line}
                    onChange={(e) => {
                      const copy = [...(page.poetryLines || [])];
                      copy[lIdx] = e.target.value;
                      updateField('poetryLines', copy);
                    }}
                    placeholder="诗句（空行代表分节）..."
                    style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                    className="w-full text-center text-[32px] text-[#242220] leading-[56px] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded p-1 outline-none"
                  />
                  <button
                    onClick={() => {
                      const copy = (page.poetryLines || []).filter((_, i) => i !== lIdx);
                      updateField('poetryLines', copy);
                    }}
                    title="删除此行"
                    className="absolute -right-8 opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              ))}

              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={() => {
                    const copy = [...(page.poetryLines || []), '新增诗句...'];
                    updateField('poetryLines', copy);
                  }}
                  className="inline-flex items-center gap-1.5 text-[22px] text-[#9B2D26] hover:bg-[#9B2D26]/10 px-3 py-1.5 rounded cursor-pointer transition-colors"
                >
                  <Plus className="size-4" />
                  <span>添加诗句</span>
                </button>
                <button
                  onClick={() => {
                    const copy = [...(page.poetryLines || []), ''];
                    updateField('poetryLines', copy);
                  }}
                  className="inline-flex items-center gap-1.5 text-[22px] text-[#242220]/60 hover:bg-black/5 px-3 py-1.5 rounded cursor-pointer transition-colors"
                >
                  <span>插入分节空行</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. 版权页 (Colophon) */}
        {page.type === 'colophon' && (
          <div
            style={{
              position: 'absolute',
              top: '531px',
              left: '290px',
              width: '860px',
              height: '920px',
            }}
            className="border-2 border-[#242220]/35 p-8 flex flex-col justify-between"
          >
            <div>
              <input
                type="text"
                value={page.title || '图书在版编目（ＣＩＰ）数据'}
                onChange={(e) => updateField('title', e.target.value)}
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-center text-[42px] font-bold text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded p-1 outline-none"
              />
              <div className="w-full h-[1px] bg-[#242220]/20 my-6" />

              <div className="space-y-3">
                {(page.colophonDetails || []).map((item, cIdx) => (
                  <div key={cIdx} className="group flex items-center gap-3">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => {
                        const copy = [...(page.colophonDetails || [])];
                        copy[cIdx] = { ...copy[cIdx], key: e.target.value };
                        updateField('colophonDetails', copy);
                      }}
                      style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                      className="w-48 text-[28px] font-bold text-[#242220]/65 bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-1 outline-none"
                    />
                    <span className="text-[28px] text-[#242220]/40">：</span>
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => {
                        const copy = [...(page.colophonDetails || [])];
                        copy[cIdx] = { ...copy[cIdx], value: e.target.value };
                        updateField('colophonDetails', copy);
                      }}
                      style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                      className="flex-1 text-[28px] text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-1 outline-none"
                    />
                    <button
                      onClick={() => {
                        const copy = (page.colophonDetails || []).filter((_, i) => i !== cIdx);
                        updateField('colophonDetails', copy);
                      }}
                      title="删除项目"
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 pt-4">
              {page.sealText !== undefined && (
                <button
                  type="button"
                  onClick={() =>
                    setSealPopoverPageIdx(sealPopoverPageIdx === pageIdx ? null : pageIdx)
                  }
                  title="点击编辑印章"
                  className="size-[72px] border-[3.5px] border-[#9B2D26] text-[#9B2D26] flex items-center justify-center font-bold text-[28px] hover:scale-105 active:scale-95 transition-transform bg-[#FAF8F5]/80 shadow-xs cursor-pointer"
                >
                  {page.sealText}
                </button>
              )}
              <span className="text-[22px] text-[#242220]/50 tracking-wider">
                ISBN 978-7-5000-0000-0 · 定价：48.00元
              </span>
            </div>
          </div>
        )}

        {/* 7. 标准图书散文正文页 (Spread) */}
        {page.type === 'spread' && (
          <div
            style={{
              position: 'absolute',
              top: '180px',
              left: `${contentLeft}px`,
              width: `${contentWidth}px`,
            }}
            className="space-y-6"
          >
            {page.title && (
              <input
                type="text"
                value={page.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="篇章小标题..."
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-left text-[40px] font-bold text-[#242220] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded p-1 outline-none"
              />
            )}

            {/* 段落列表 */}
            <div className="space-y-4">
              {(page.paragraphs || []).map((p, pIdx) => (
                <div key={pIdx} className="group relative">
                  <textarea
                    rows={Math.max(2, Math.ceil(p.length / 32))}
                    value={p}
                    onChange={(e) => {
                      const copy = [...(page.paragraphs || [])];
                      copy[pIdx] = e.target.value;
                      updateField('paragraphs', copy);
                    }}
                    style={{
                      fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif',
                      textIndent: '2em',
                    }}
                    className="w-full text-[31px] text-[#242220] leading-[60px] bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded p-2 outline-none resize-none transition-colors"
                  />
                  <div className="absolute right-0 -top-4 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white/90 border border-[#E2DDD3] px-2 py-0.5 rounded shadow-xs transition-opacity z-10">
                    <button
                      onClick={() => {
                        const copy = [...(page.paragraphs || [])];
                        copy.splice(pIdx + 1, 0, '新段落内容...');
                        updateField('paragraphs', copy);
                      }}
                      title="在此段下方插入新段"
                      className="text-[18px] text-[#9B2D26] hover:underline flex items-center gap-1"
                    >
                      <Plus className="size-4" />
                      <span>插入段</span>
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        const copy = (page.paragraphs || []).filter((_, i) => i !== pIdx);
                        updateField('paragraphs', copy);
                      }}
                      title="删除此段"
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  const copy = [...(page.paragraphs || []), '点击输入新段落正文...'];
                  updateField('paragraphs', copy);
                }}
                className="inline-flex items-center gap-2 text-[22px] text-[#9B2D26] hover:bg-[#9B2D26]/10 px-3 py-1.5 rounded cursor-pointer transition-colors"
              >
                <Plus className="size-5" />
                <span>添加正文段落</span>
              </button>
            </div>

            {/* 脚注 Notes */}
            {(page.notes || []).length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '1460px',
                  left: 0,
                  width: `${contentWidth}px`,
                }}
                className="pt-4 border-t border-[#242220]/20 space-y-2"
              >
                {(page.notes || []).map((note, nIdx) => (
                  <div key={nIdx} className="group relative flex items-center">
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => {
                        const copy = [...(page.notes || [])];
                        copy[nIdx] = e.target.value;
                        updateField('notes', copy);
                      }}
                      style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                      className="w-full text-[24px] text-[#242220]/65 bg-transparent hover:bg-black/5 focus:bg-white/95 focus:ring-1 focus:ring-[#9B2D26] rounded px-2 py-0.5 outline-none"
                    />
                    <button
                      onClick={() => {
                        const copy = (page.notes || []).filter((_, i) => i !== nIdx);
                        updateField('notes', copy);
                      }}
                      title="删除注释"
                      className="absolute -right-8 opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 朱砂印章修改弹层 */}
        {sealPopoverPageIdx === pageIdx && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '460px',
            }}
            className="z-50 bg-[#FAF8F5] border-2 border-[#9B2D26] rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#E2DDD3]">
              <span className="text-[26px] font-bold text-[#9B2D26]">
                印章字样设置
              </span>
              <button
                onClick={() => setSealPopoverPageIdx(null)}
                className="p-1 rounded hover:bg-black/10 cursor-pointer"
              >
                <X className="size-6 text-[#242220]" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[20px] text-[#242220]/75">
                印文汉字（建议 2 或 4 个汉字）：
              </label>
              <input
                type="text"
                maxLength={4}
                value={page.sealText || ''}
                onChange={(e) => updateField('sealText', e.target.value)}
                placeholder="如：文心、雅趣、典藏..."
                style={{ fontFamily: '"LXGW WenKai", "LXGW WenKai Mono", serif' }}
                className="w-full text-[32px] text-center font-bold text-[#9B2D26] h-14 bg-white border border-[#9B2D26] rounded outline-none"
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <span className="text-[18px] text-[#242220]/60">预设古印词：</span>
              <div className="flex flex-wrap gap-2">
                {PRESET_SEALS.map((stamp) => (
                  <button
                    key={stamp}
                    onClick={() => updateField('sealText', stamp)}
                    className="px-2.5 py-1 rounded border border-[#9B2D26]/40 text-[#9B2D26] text-[20px] hover:bg-[#9B2D26]/10 cursor-pointer"
                  >
                    {stamp}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSealPopoverPageIdx(null)}
                className="px-6 py-2 rounded bg-[#9B2D26] text-white text-[20px] font-bold shadow-xs cursor-pointer hover:bg-[#83251F]"
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 size-full pointer-events-auto z-40">
      {/* 1. 浮动顶层沉浸式编辑器工具栏 */}
      <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#E2DDD3] shadow-lg text-xs text-[#242220] whitespace-nowrap animate-in fade-in slide-in-from-top-2 font-serif">
        <div className="flex items-center gap-1.5 pr-2 border-r border-[#E2DDD3]">
          <span className="size-2 rounded-full bg-[#9B2D26] animate-pulse" />
          <span className="font-bold text-[#9B2D26]">在页编辑中</span>
          <span className="text-[#242220]/60 hidden sm:inline">
            · 直接点击书页字样即可修改
          </span>
        </div>

        {/* 翻页切换 */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#E2DDD3]">
          <button
            disabled={currentSheet <= 0}
            onClick={() => onGoToSheet(Math.max(0, currentSheet - 1))}
            className="p-1 rounded hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="上一张"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="font-mono text-[11px] px-1">
            {currentSheet === 0
              ? '封面'
              : currentSheet === totalSheets
              ? '封底'
              : `${leftPageNum}-${rightPageNum}`}
          </span>
          <button
            disabled={currentSheet >= totalSheets}
            onClick={() => onGoToSheet(Math.min(totalSheets, currentSheet + 1))}
            className="p-1 rounded hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="下一张"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {/* 当前编辑页侧选择 */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#E2DDD3]">
          {leftPageNum !== null && (
            <button
              onClick={() => setActiveSide('left')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                activeSide === 'left'
                  ? 'bg-[#9B2D26] text-white font-bold'
                  : 'hover:bg-black/5 text-[#242220]'
              }`}
            >
              左页 ({leftPageNum})
            </button>
          )}
          {rightPageNum !== null && (
            <button
              onClick={() => setActiveSide('right')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                activeSide === 'right'
                  ? 'bg-[#9B2D26] text-white font-bold'
                  : 'hover:bg-black/5 text-[#242220]'
              }`}
            >
              右页 ({rightPageNum})
            </button>
          )}
        </div>

        {/* 版式切换 */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-[#E2DDD3]">
          <span className="text-[11px] text-[#242220]/60 hidden md:inline">版式:</span>
          <select
            value={activePage.type}
            onChange={(e) =>
              handleUpdateActiveField('type', e.target.value as PageContent['type'])
            }
            className="h-6 px-1.5 rounded bg-transparent border border-[#E2DDD3] text-[11px] font-medium text-[#9B2D26] focus:outline-none cursor-pointer"
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

        {/* 单页恢复 */}
        <button
          onClick={() => onResetPage(activePageIdx)}
          title="将当前页恢复为默认初版范文"
          className="p-1 rounded hover:bg-black/5 text-[#242220]/60 hover:text-[#9B2D26] cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
        </button>

        {/* 导出 / 导入 */}
        <button
          onClick={handleExportJson}
          title="导出全书 JSON"
          className="p-1 rounded hover:bg-black/5 text-[#242220]/60 hover:text-[#242220] cursor-pointer"
        >
          <Download className="size-3.5" />
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          title="导入全书 JSON"
          className="p-1 rounded hover:bg-black/5 text-[#242220]/60 hover:text-[#242220] cursor-pointer"
        >
          <Upload className="size-3.5" />
        </button>

        {/* 完成退出 */}
        <button
          onClick={onCloseEditMode}
          className="ml-1 px-3 py-1 rounded-full bg-[#9B2D26] hover:bg-[#83251F] text-white font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
        >
          <Check className="size-3.5" />
          <span>完成编辑</span>
        </button>
      </div>

      {/* 2. 在 3D 书页表面 1:1 投影的交互层 */}
      <div className="relative size-full pointer-events-auto">
        {/* 左页 */}
        {renderSinglePageOverlay(leftPageNum, 'left')}

        {/* 右页 */}
        {renderSinglePageOverlay(rightPageNum, 'right')}
      </div>

      {/* 3. 导入 JSON 模态窗 */}
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
              请在此黏贴全书 JSON 数组，导入后将立刻更新 3D 翻页书的全部页面。
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
    </div>
  );
};
