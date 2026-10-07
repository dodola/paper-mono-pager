import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MagazineEngine } from './magazine/MagazineEngine';
import { pageSound } from './magazine/pageSound';
import { CHINESE_PAGES } from './magazine/chinesePublicationData';
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
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MagazineEngine | null>(null);

  const [currentSheet, setCurrentSheet] = useState(0);
  const [leftPage, setLeftPage] = useState<number | null>(null);
  const [rightPage, setRightPage] = useState<number | null>(1);
  const [totalSheets, setTotalSheets] = useState(Math.ceil(CHINESE_PAGES.length / 2));
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);

  // 动态自适应尺寸（保持 1.44753 宽高比，最大限度填满可用空间）
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 1181,
    height: 816,
  });

  const patternUrl = '/assets/pages/texture.webp';

  // 监听容器大小变化，自适应最大化书籍
  useEffect(() => {
    if (!stageWrapperRef.current) return;

    const updateSize = (pW: number, pH: number) => {
      if (!pW || !pH) return;
      // 预留微小安全边距
      const availableW = Math.max(280, pW - 16);
      const availableH = Math.max(200, pH - 16);
      const aspect = 1.44753;

      let w = availableW;
      let h = w / aspect;
      if (h > availableH) {
        h = availableH;
        w = h * aspect;
      }

      setStageSize({
        width: Math.floor(w),
        height: Math.floor(h),
      });
    };

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      updateSize(width, height);
    });

    ro.observe(stageWrapperRef.current);
    return () => ro.disconnect();
  }, []);

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
      document.documentElement.requestFullscreen?.();
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
      return `第 ${leftPage} · ${rightPage} 页 ${l}`;
    }
    return l ? `第 ${leftPage} 页 ${l}` : `第 ${rightPage} 页 ${r}`;
  };

  return (
    <div className={`relative size-full flex flex-col justify-between select-none ${className}`}>
      {/* 1. 书籍主体展示区：自适应 Window 大小，填满中间所有可用空间 */}
      <div
        ref={stageWrapperRef}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden p-2 sm:p-4"
      >
        <div
          className="relative transition-all duration-75"
          style={{
            width: `${stageSize.width}px`,
            height: `${stageSize.height}px`,
          }}
        >
          {/* Magazine 3D Engine Mount Point */}
          <div
            ref={containerRef}
            className="absolute inset-0 size-full cursor-grab active:cursor-grabbing"
          />

          {/* 交互提示气泡 */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-[#242220]/75 px-3.5 py-1 text-xs text-white/90 backdrop-blur-md opacity-75 hover:opacity-100 transition-opacity whitespace-nowrap">
            <Sparkles className="size-3 text-[#e5b299]" />
            <span>单击或拖拽边缘翻页 · 按住不放极速连翻</span>
          </div>

          {/* 左右快捷翻页悬浮按钮 */}
          <button
            onClick={() => engineRef.current?.flipPrev()}
            disabled={currentSheet <= 0}
            aria-label="上一页"
            className="absolute -left-3 sm:-left-1 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/85 hover:bg-white text-[#242220] shadow-md border border-[#222]/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            onClick={() => engineRef.current?.flipNext()}
            disabled={currentSheet >= totalSheets}
            aria-label="下一页"
            className="absolute -right-3 sm:-right-1 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/85 hover:bg-white text-[#242220] shadow-md border border-[#222]/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      </div>

      {/* 2. 底部控制栏与跳转胶囊：对齐窗口最底部 (Align Window Bottom) */}
      <div className="w-full shrink-0 z-30 pb-3 pt-1.5 px-4 flex flex-col items-center gap-2 bg-[#F6F6F3]/95 backdrop-blur-sm border-t border-[#E8E4DC]/70">
        {/* 控制条 */}
        <div className="w-full max-w-[960px] flex items-center justify-between gap-3 rounded-full border border-[#E4E0D6] bg-white/90 px-4 py-2 shadow-sm">
          {/* 左侧：回到封面与标题页码 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => engineRef.current?.goToSheet(0)}
              title="回到封面"
              className="p-1 rounded-full hover:bg-black/5 text-[#242220] transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <span className="text-xs font-semibold tracking-wide text-[#242220] max-w-[260px] sm:max-w-[340px] truncate">
              {formatSpreadLabel()}
            </span>
            <span className="text-[11px] text-[#242220]/45 font-mono">
              ({currentSheet}/{totalSheets})
            </span>
          </div>

          {/* 中间：进度滑动条 */}
          <div className="flex-1 w-full min-w-[80px] mx-2 flex items-center">
            <input
              type="range"
              min={0}
              max={totalSheets}
              value={currentSheet}
              onChange={handleSliderChange}
              className="w-full h-1 bg-[#E2DED4] rounded-lg appearance-none cursor-pointer accent-[#9B2D26]"
            />
          </div>

          {/* 右侧：色调、自动、音效、全屏 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 纸张色调切换 */}
            <div className="flex items-center gap-1.5 border-r border-[#222]/10 pr-2.5">
              <Palette className="size-3 text-[#242220]/45" />
              {PAPER_THEMES.map((theme, i) => (
                <button
                  key={theme.name}
                  onClick={() => changeTheme(i)}
                  title={`纸张色调：${theme.name}`}
                  className={`size-4 rounded-full border transition-all cursor-pointer ${
                    selectedThemeIndex === i
                      ? 'ring-2 ring-[#9B2D26] ring-offset-1 scale-110'
                      : 'border-black/25 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: theme.bg }}
                />
              ))}
            </div>

            {/* 自动连读 */}
            <button
              onClick={() => setAutoPlay((p) => !p)}
              title={autoPlay ? '暂停自动翻页' : '开启自动连读'}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                autoPlay ? 'bg-[#9B2D26] text-white font-medium' : 'hover:bg-black/5 text-[#242220]'
              }`}
            >
              {autoPlay ? <Pause className="size-3" /> : <Play className="size-3" />}
              <span>{autoPlay ? '暂停' : '自动'}</span>
            </button>

            {/* 音效 */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? '静音翻页声' : '开启纸张翻书音效'}
              className="p-1 rounded hover:bg-black/5 text-[#242220] transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5 text-red-500" />}
            </button>

            {/* 全屏 */}
            <button
              onClick={toggleFullscreen}
              title="切换全屏演示"
              className="p-1 rounded hover:bg-black/5 text-[#242220] transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* 缩略目录快速跳转条 */}
        <div className="w-full max-w-[960px] flex items-center justify-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {Array.from({ length: totalSheets + 1 }).map((_, idx) => {
            const pageNum = idx === 0 ? '封面' : idx === totalSheets ? '封底' : `${2 * idx - 1}-${2 * idx}`;
            return (
              <button
                key={idx}
                onClick={() => engineRef.current?.goToSheet(idx)}
                className={`shrink-0 h-6 px-2.5 rounded text-[11px] transition-all cursor-pointer ${
                  currentSheet === idx
                    ? 'bg-[#9B2D26] text-white font-bold shadow-xs'
                    : 'bg-white/70 hover:bg-white text-[#242220]/60 hover:text-[#242220] border border-[#242220]/10'
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
