import React, { useState } from 'react';
import { PaperMagazine } from 'paper-mono-pager';
import { ExternalLink, PenTool } from 'lucide-react';

export default function App() {
  const [isEditMode, setIsEditMode] = useState(false);

  return (
    <div className="h-screen h-dvh w-screen bg-[#F6F6F3] text-[#242220] flex flex-col overflow-hidden selection:bg-[#9B2D26] selection:text-white">
      {/* 极简精致顶栏 */}
      <header className="shrink-0 z-40 w-full px-4 sm:px-8 h-12 flex items-center justify-between border-b border-[#E8E4DC] bg-[#F6F6F3]/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-6 items-center justify-center rounded bg-[#9B2D26] text-white text-xs font-bold shadow-xs">
            文
          </span>
          <span className="font-bold text-sm sm:text-base tracking-widest text-[#242220]">
            文心雅集
          </span>
          <span className="text-xs text-[#242220]/40 pl-1 hidden sm:inline">
            · 霞鹜文楷 中文典藏本
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#242220]/50 hidden lg:inline">
            16 页全书霞鹜文楷实时排印 · 真实 3D 物理卷曲
          </span>

          {/* 编辑模式顶栏入口 */}
          <button
            onClick={() => setIsEditMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs transition-colors cursor-pointer ${
              isEditMode
                ? 'bg-[#9B2D26] text-white shadow-xs'
                : 'bg-[#9B2D26]/10 text-[#9B2D26] hover:bg-[#9B2D26]/15'
            }`}
          >
            <PenTool className="size-3" />
            <span>{isEditMode ? '退出排印编辑' : '编辑全书排印'}</span>
          </button>

          <a
            href="https://paper.design/mono"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs bg-black/5 hover:bg-black/10 text-[#242220] transition-colors"
          >
            <span>原站 paper.design</span>
            <ExternalLink className="size-3 text-[#242220]/50" />
          </a>
        </div>
      </header>

      {/* 主展示区：包含自适应大画幅 3D 书籍与靠底对齐的控制条 */}
      <main className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
        <PaperMagazine
          className="size-full"
          isEditMode={isEditMode}
          onToggleEditMode={() => setIsEditMode((prev) => !prev)}
        />
      </main>
    </div>
  );
}
