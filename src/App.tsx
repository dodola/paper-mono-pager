import React from 'react';
import { PaperMagazine } from './components/PaperMagazine';
import { ExternalLink } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#242220] flex flex-col justify-between overflow-x-hidden selection:bg-[#9B2D26] selection:text-white">
      {/* 极简顶栏 */}
      <header className="z-40 w-full px-6 sm:px-10 h-14 flex items-center justify-between border-b border-[#E8E4DC] bg-[#F6F6F3]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-6 items-center justify-center rounded bg-[#9B2D26] text-white text-xs font-bold shadow-xs">
            文
          </span>
          <span className="font-bold text-base tracking-widest text-[#242220]">
            文心雅集
          </span>
          <span className="text-xs text-[#242220]/40 pl-1.5 hidden sm:inline">
            · 中文经典散文典藏本
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-[#242220]/50 hidden md:inline">
            16 页全书纯文本实时渲染 · 真实 3D 物理卷曲
          </span>
          <a
            href="https://paper.design/mono"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs bg-black/5 hover:bg-black/10 text-[#242220] transition-colors"
          >
            <span>对照原站 paper.design</span>
            <ExternalLink className="size-3 text-[#242220]/50" />
          </a>
        </div>
      </header>

      {/* 纯粹的 3D 翻页演示主舞台 */}
      <main className="flex-1 w-full flex flex-col items-center justify-center py-2 sm:py-4 px-2 sm:px-4">
        <PaperMagazine />
      </main>

      {/* 极简底栏 */}
      <footer className="w-full py-2.5 px-6 text-center text-[11px] text-[#242220]/35 border-t border-[#E8E4DC]/60">
        《文心雅集》· 3D WebGL 真实物理翻页引擎（1181 × 816 出版级画幅演示）
      </footer>
    </div>
  );
}
