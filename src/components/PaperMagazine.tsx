import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MagazineEngine } from './magazine/MagazineEngine';
import { pageSound } from './magazine/pageSound';
import { CHINESE_PAGES, PageContent } from './magazine/chinesePublicationData';
import { RenderOptions } from './magazine/pageRenderer';
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Palette,
} from 'lucide-react';

export interface PaperMagazineProps {
  className?: string;
}

const PAPER_THEMES = [
  { name: '古籍米宣', bg: '#F9F7F2', text: '#242220', accent: '#9B2D26' },
  { name: '竹青素白', bg: '#F5F7F4', text: '#1E2321', accent: '#2D5A46' },
  { name: '暖调象牙', bg: '#FDFBF7', text: '#25211E', accent: '#A03B26' },
  { name: '怀旧古纸', bg: '#F5EFE6', text: '#2C2723', accent: '#8C2B21' },
];

export const PaperMagazine: React.FC<PaperMagazineProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MagazineEngine | null>(null);

  const [currentSheet, setCurrentSheet] = useState(0);
  const [leftPage, setLeftPage] = useState<number | null>(null);
  const [rightPage, setRightPage] = useState<number | null>(1);
  const [totalSheets, setTotalSheets] = useState(Math.ceil(CHINESE_PAGES.length / 2));
  const [isReady, setIsReady] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);

  const patternUrl = '/assets/pages/texture.webp';

  useEffect(() => {
    if (!containerRef.current) return;

    const currentTheme = PAPER_THEMES[selectedThemeIndex];
    const renderOptions: RenderOptions = {
      paperColor: currentTheme.bg,
      textColor: currentTheme.text,
      accentColor: currentTheme.accent,
    };

    const engine = new MagazineEngine({
      container: containerRef.current,
      pageContents: CHINESE_PAGES,
      patternUrl,
      renderOptions,
      onPageChange: (sheetIdx, left, right) => {
        setCurrentSheet(sheetIdx);
        setLeftPage(left);
        setRightPage(right);
        pageSound.playFlip();
      },
      onReady: () => {
        setIsReady(true);
      },
    });

    engineRef.current = engine;
    setTotalSheets(engine.getTotalSheets());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const changeTheme = (idx: number) => {
    setSelectedThemeIndex(idx);
    const theme = PAPER_THEMES[idx];
    engineRef.current?.renderAllPageTextures({
      paperColor: theme.bg,
      textColor: theme.text,
      accentColor: theme.accent,
    });
  };

  // 键盘快捷翻页
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        engineRef.current?.flipNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        engineRef.current?.flipPrev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        engineRef.current?.goToSheet(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        if (engineRef.current) {
          engineRef.current.goToSheet(engineRef.current.getTotalSheets());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 自动翻页计时器
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      if (!engineRef.current) return;
      const current = engineRef.current.getCurrentSheet();
      const total = engineRef.current.getTotalSheets();

      if (current >= total) {
        engineRef.current.goToSheet(0);
      } else {
        engineRef.current.flipNext();
      }
    }, 2800);

    return () => clearInterval(interval);
  }, [autoPlay]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      pageSound.setEnabled(next);
      return next;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.parentElement?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sheetIdx = Number(e.target.value);
    engineRef.current?.goToSheet(sheetIdx);
  };

  const formatSpreadLabel = () => {
    if (currentSheet === 0) return '封面 · 卷首';
    if (currentSheet === totalSheets) return '封底 · 版权页';
    const l = leftPage ? CHINESE_PAGES[leftPage - 1]?.title || `第 ${leftPage} 页` : '';
    const r = rightPage ? CHINESE_PAGES[rightPage - 1]?.title || `第 ${rightPage} 页` : '';
    if (l && r) {
      return `第 ${leftPage}、${rightPage} 页（${l} / ${r}）`;
    }
    return l ? `第 ${leftPage} 页（${l}）` : `第 ${rightPage} 页（${r}）`;
  };

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* 3D 舞台区域 */}
      <div className="relative w-full max-w-[1240px] px-4 md:px-8 flex flex-col items-center">
        {/* Aspect Frame */}
        <div
          className="relative w-full aspect-[1.44753] max-h-[calc(100vh-170px)] min-h-[360px] rounded-lg shadow-xl/5 border border-[#222222]/10 bg-[#f9f7f2] overflow-hidden"
          style={{
            boxShadow:
              '0 24px 48px -12px rgba(0, 0, 0, 0.08), 0 12px 24px -8px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.04)',
          }}
        >
          {/* Magazine 3D Engine Mount Point */}
          <div
            ref={containerRef}
            className="absolute inset-0 size-full cursor-grab active:cursor-grabbing"
          />

          {/* 交互提示气泡 */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-[#242220]/80 px-4 py-1.5 text-xs text-white backdrop-blur-md opacity-85 transition-opacity hover:opacity-100">
            <Sparkles className="size-3.5 text-[#e5b299]" />
            <span>鼠标拖拽边缘或单击翻页 • 长按可极速连翻 • 支持键盘左右键</span>
          </div>

          {/* 左右快捷翻页悬浮按钮 */}
          <button
            onClick={() => engineRef.current?.flipPrev()}
            disabled={currentSheet <= 0}
            aria-label="上一页"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/70 hover:bg-white text-[#242220] shadow-md border border-[#222]/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            onClick={() => engineRef.current?.flipNext()}
            disabled={currentSheet >= totalSheets}
            aria-label="下一页"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/70 hover:bg-white text-[#242220] shadow-md border border-[#222]/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>

        {/* 底部功能控制条 */}
        <div className="mt-5 w-full max-w-[880px] flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-[#222222]/10 bg-white/80 p-3.5 shadow-sm backdrop-blur-md">
          {/* 页码与跨页状态 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => engineRef.current?.goToSheet(0)}
              title="回到封面"
              className="p-1.5 rounded-md hover:bg-black/5 text-[#242220] transition-colors cursor-pointer"
            >
              <RotateCcw className="size-4" />
            </button>
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-wide text-[#242220] max-w-[280px] truncate">
                {formatSpreadLabel()}
              </span>
              <span className="text-[11px] text-[#242220]/50">
                跨页进度：{currentSheet} / {totalSheets}
              </span>
            </div>
          </div>

          {/* 进度滑动条 */}
          <div className="flex-1 w-full sm:w-auto mx-2 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={totalSheets}
              value={currentSheet}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-[#e4e1d9] rounded-lg appearance-none cursor-pointer accent-[#9B2D26]"
            />
          </div>

          {/* 右侧控制选项 */}
          <div className="flex items-center gap-2">
            {/* 纸张色调切换 */}
            <div className="flex items-center gap-1 border-r border-[#222]/10 pr-2">
              <Palette className="size-3.5 text-[#242220]/50 mr-0.5" />
              {PAPER_THEMES.map((theme, i) => (
                <button
                  key={theme.name}
                  onClick={() => changeTheme(i)}
                  title={`切换为：${theme.name}`}
                  className={`size-5 rounded-full border transition-all cursor-pointer ${
                    selectedThemeIndex === i ? 'ring-2 ring-[#9B2D26] ring-offset-1 scale-110' : 'border-black/20'
                  }`}
                  style={{ backgroundColor: theme.bg }}
                />
              ))}
            </div>

            {/* 自动翻页 */}
            <button
              onClick={() => setAutoPlay((p) => !p)}
              title={autoPlay ? '暂停自动翻页' : '开启自动连读'}
              className={`px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                autoPlay ? 'bg-[#9B2D26] text-white' : 'hover:bg-black/5 text-[#242220]'
              }`}
            >
              {autoPlay ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              <span>{autoPlay ? '暂停' : '自动'}</span>
            </button>

            {/* 音效切换 */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? '静音翻页声' : '开启纸张翻书音效'}
              className="p-1.5 rounded-md hover:bg-black/5 text-[#242220] transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4 text-red-500" />}
            </button>

            {/* 全屏模式 */}
            <button
              onClick={toggleFullscreen}
              title="切换全屏沉浸模式"
              className="p-1.5 rounded-md hover:bg-black/5 text-[#242220] transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>

        {/* 缩略目录快速跳转条 */}
        <div className="mt-4 w-full max-w-[880px] flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {Array.from({ length: totalSheets + 1 }).map((_, idx) => {
            const pageNum = idx === 0 ? '封面' : idx === totalSheets ? '封底' : `${2 * idx - 1}-${2 * idx}`;
            return (
              <button
                key={idx}
                onClick={() => engineRef.current?.goToSheet(idx)}
                className={`shrink-0 h-8 px-3 rounded border text-xs transition-all cursor-pointer ${
                  currentSheet === idx
                    ? 'border-[#9B2D26] bg-[#9B2D26] text-white font-bold shadow-sm'
                    : 'border-[#242220]/15 bg-white/70 hover:bg-white text-[#242220]/70 hover:text-[#242220]'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
