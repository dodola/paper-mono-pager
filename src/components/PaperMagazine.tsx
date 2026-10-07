import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MagazineEngine } from './magazine/MagazineEngine';
import { pageSound } from './magazine/pageSound';
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
} from 'lucide-react';

export interface PaperMagazineProps {
  className?: string;
}

export const PaperMagazine: React.FC<PaperMagazineProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MagazineEngine | null>(null);

  const [currentSheet, setCurrentSheet] = useState(0);
  const [leftPage, setLeftPage] = useState<number | null>(null);
  const [rightPage, setRightPage] = useState<number | null>(1);
  const [totalSheets, setTotalSheets] = useState(14);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate page URLs array (28 pages)
  const pageUrls = useRef<string[]>(
    Array.from({ length: 28 }, (_, i) => `/assets/pages/page_${(i + 1).toString().padStart(2, '0')}.png`)
  ).current;

  const patternUrl = '/assets/pages/texture.webp';

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new MagazineEngine({
      container: containerRef.current,
      pages: pageUrls,
      patternUrl,
      onPageChange: (sheetIdx, left, right) => {
        setCurrentSheet(sheetIdx);
        setLeftPage(left);
        setRightPage(right);
        pageSound.playFlip();
      },
      onProgress: (loaded, total) => {
        setLoadedCount(loaded);
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
  }, [pageUrls]);

  // Keyboard navigation
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

  // Autoplay timer
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
    }, 2400);

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
    if (currentSheet === 0) return 'Front Cover — Page 01';
    if (currentSheet === totalSheets) return 'Back Cover — Page 28';
    const l = leftPage ? leftPage.toString().padStart(2, '0') : '--';
    const r = rightPage ? rightPage.toString().padStart(2, '0') : '--';
    return `Pages ${l} – ${r}`;
  };

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* 3D Book Stage */}
      <div className="relative w-full max-w-[1240px] px-4 md:px-8 flex flex-col items-center">
        {/* Aspect Frame */}
        <div
          className="relative w-full aspect-[1.44753] max-h-[calc(100vh-170px)] min-h-[360px] rounded-lg shadow-xl/5 border border-[#222222]/10 bg-[#f9f9f6] overflow-hidden"
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

          {/* Initial Loading Overlay */}
          {!isReady && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#F6F6F3]/90 backdrop-blur-sm transition-opacity duration-300">
              <div className="flex items-center gap-3 text-sm font-mono tracking-tight text-[#222]">
                <div className="size-4 rounded-full border-2 border-[#222] border-t-transparent animate-spin" />
                <span>Loading Paper Mono Specimen ({loadedCount}/28)...</span>
              </div>
            </div>
          )}

          {/* Interaction Instruction pill */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-[#222222]/80 px-3.5 py-1 text-xs text-white backdrop-blur-md opacity-80 transition-opacity hover:opacity-100">
            <Sparkles className="size-3.5 text-[#81acec]" />
            <span>Click or drag page edge to curl & flip • Hold to flip fast</span>
          </div>

          {/* Quick Page Prev/Next Hover Edge Buttons */}
          <button
            onClick={() => engineRef.current?.flipPrev()}
            disabled={currentSheet <= 0}
            aria-label="Previous Page"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/70 hover:bg-white text-[#222] shadow-md border border-[#222]/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            onClick={() => engineRef.current?.flipNext()}
            disabled={currentSheet >= totalSheets}
            aria-label="Next Page"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-white/70 hover:bg-white text-[#222] shadow-md border border-[#222]/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>

        {/* Bottom Control Bar */}
        <div className="mt-5 w-full max-w-[840px] flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-[#222222]/10 bg-white/80 p-3.5 shadow-sm backdrop-blur-md">
          {/* Spread Indicator & Rewind */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => engineRef.current?.goToSheet(0)}
              title="Return to Cover"
              className="p-1.5 rounded-md hover:bg-black/5 text-[#222] transition-colors cursor-pointer"
            >
              <RotateCcw className="size-4" />
            </button>
            <span className="font-mono text-xs font-semibold tracking-wide text-[#222]">
              {formatSpreadLabel()}
            </span>
            <span className="text-xs text-[#222]/40 font-mono">
              ({currentSheet}/{totalSheets})
            </span>
          </div>

          {/* Page Slider */}
          <div className="flex-1 w-full sm:w-auto mx-2 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={totalSheets}
              value={currentSheet}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-[#e2e2dd] rounded-lg appearance-none cursor-pointer accent-[#222222]"
            />
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5">
            {/* Auto Play */}
            <button
              onClick={() => setAutoPlay((p) => !p)}
              title={autoPlay ? 'Pause Auto-Play' : 'Auto-Play Slideshow'}
              className={`p-2 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                autoPlay ? 'bg-[#222] text-white' : 'hover:bg-black/5 text-[#222]'
              }`}
            >
              {autoPlay ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              <span className="hidden sm:inline">{autoPlay ? 'Pause' : 'Auto'}</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Mute Flip Sound' : 'Enable Flip Sound'}
              className="p-2 rounded-lg hover:bg-black/5 text-[#222] transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4 text-red-500" />}
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="p-2 rounded-lg hover:bg-black/5 text-[#222] transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>

        {/* Quick Page Thumbnail Navigator Strip */}
        <div className="mt-4 w-full max-w-[840px] flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {Array.from({ length: totalSheets + 1 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => engineRef.current?.goToSheet(idx)}
              className={`shrink-0 h-9 px-2.5 rounded border text-xs font-mono transition-all cursor-pointer ${
                currentSheet === idx
                  ? 'border-[#222] bg-[#222] text-white font-bold shadow-sm'
                  : 'border-[#222]/15 bg-white/60 hover:bg-white text-[#222]/70 hover:text-[#222]'
              }`}
            >
              {idx === 0 ? 'Cover' : idx === totalSheets ? 'Back' : `${2 * idx}-${2 * idx + 1}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
