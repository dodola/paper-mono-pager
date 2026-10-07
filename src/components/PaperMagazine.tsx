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
      return `第 ${leftPage} · ${rightPage} 页  ${l}`;
    }
    return l ? `第 ${leftPage} 页  ${l}` : `第 ${rightPage} 页  ${r}`;
  };

  return (
    <div className={`relative w-full flex flex-col items-center select-none ${className}`}>
      {/* 3D 大画幅主舞台（按 1.44753 物理比例自适应最大化，完美达成 1181×816 巨幅展示） */}
      <div className="relative w-full flex justify-center items-center my-auto">
        <div
          className="relative"
          style={{
            height: 'min(calc(100vh - 125px), 816px)',
            aspectRatio: '1.44753',
            maxWidth: 'min(96vw, 1220px)',
          }}
        >
          {/* Magazine 3D Engine Mount Point: 尺寸放大至 1181×816，3D 物理光影自然投射在桌面 */}
          <div
            ref={containerRef}
            className="absolute inset-0 size-full cursor-grab active:cursor-grabbing"
          />

          {/* 交互提示气泡 */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-[#242220]/75 px-4 py-1 text-xs text-white/90 backdrop-blur-md opacity-75 hover:opacity-100 transition-opacity">
            <Sparkles className="size-3 text-[#e5b299]" />
            <span>单击或按住边缘拖拽翻页 · 按住不放极速连翻</span>
          </div>

          {/* 左右快捷翻页悬浮按钮 */}
          <button
            onClick={() => engineRef.current?.flipPrev()}
            disabled={currentSheet <= 0}
            aria-label="上一页"
            className="absolute -left-2 sm:left-1 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/80 hover:bg-white text-[#242220] shadow-md border border-[#222]/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            onClick={() => engineRef.current?.flipNext()}
            disabled={currentSheet >= totalSheets}
            aria-label="下一页"
            className="absolute -right-2 sm:right-1 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/80 hover:bg-white text-[#242220] shadow-md border border-[#222]/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      </div>

      {/* 底部紧凑精致控制条 */}
      <div className="mt-3.5 w-full max-w-[1020px] px-3 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-full border border-[#E4E0D6] bg-white/90 px-5 py-2.5 shadow-sm backdrop-blur-md">
        {/* 页码与跨页状态 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => engineRef.current?.goToSheet(0)}
            title="回到封面"
            className="p-1 rounded hover:bg-black/5 text-[#242220] transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </button>
          <span className="text-xs font-semibold tracking-wide text-[#242220] max-w-[320px] truncate">
            {formatSpreadLabel()}
          </span>
          <span className="text-[11px] text-[#242220]/45">
            ({currentSheet}/{totalSheets})
          </span>
        </div>

        {/* 进度滑动条 */}
        <div className="flex-1 w-full sm:w-auto mx-2 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={totalSheets}
            value={currentSheet}
            onChange={handleSliderChange}
            className="w-full h-1 bg-[#E2DED4] rounded-lg appearance-none cursor-pointer accent-[#9B2D26]"
          />
        </div>

        {/* 右侧控制选项 */}
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
                  selectedThemeIndex === i ? 'ring-2 ring-[#9B2D26] ring-offset-1 scale-110' : 'border-black/25 opacity-70 hover:opacity-100'
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

      {/* 缩略目录快速跳转条（紧凑精简） */}
      <div className="mt-2 w-full max-w-[1020px] flex items-center justify-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {Array.from({ length: totalSheets + 1 }).map((_, idx) => {
          const pageNum = idx === 0 ? '封面' : idx === totalSheets ? '封底' : `${2 * idx - 1}-${2 * idx}`;
          return (
            <button
              key={idx}
              onClick={() => engineRef.current?.goToSheet(idx)}
              className={`shrink-0 h-6 px-2.5 rounded text-[11px] transition-all cursor-pointer ${
                currentSheet === idx
                  ? 'bg-[#9B2D26] text-white font-bold shadow-xs'
                  : 'bg-white/60 hover:bg-white text-[#242220]/60 hover:text-[#242220] border border-[#242220]/10'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>
    </div>
  );
};
