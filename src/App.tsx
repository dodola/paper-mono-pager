import React from 'react';
import { PaperMagazine } from './components/PaperMagazine';
import { ExternalLink, BookOpen, Layers, Sparkles, Cpu, CheckCircle, Feather, Type, FileText } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#242220] flex flex-col selection:bg-[#9B2D26] selection:text-white">
      {/* 顶部中式典雅标题栏 */}
      <header className="sticky top-0 z-40 w-full border-b border-[#E2DDD3] bg-[#F6F6F3]/90 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo 与书名 */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded bg-[#9B2D26] text-white text-sm font-bold shadow-xs">
                文
              </span>
              <span className="font-bold text-lg tracking-wider text-[#242220]">
                文心雅集
              </span>
              <span className="text-xs text-[#242220]/50 border-l border-[#242220]/20 pl-2 hidden sm:inline">
                中文出版物 3D 翻页书引擎
              </span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-[#242220]/60">
              <span className="rounded bg-black/5 px-2 py-0.5">纯文本实时渲染</span>
              <span className="rounded bg-black/5 px-2 py-0.5">思源宋体 · 出版排印</span>
              <span className="rounded bg-emerald-500/10 text-emerald-800 px-2 py-0.5 font-medium">100% 物理着色器复刻</span>
            </div>
          </div>

          {/* 右侧指示 */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[#242220]/60 hidden sm:inline">16 页完整典籍文集</span>
            <a
              href="https://paper.design/mono"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium bg-[#242220] text-white hover:bg-[#9B2D26] transition-colors"
            >
              <span>对照原站 paper.design</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </header>

      {/* 主展台区域 */}
      <main className="flex-1 w-full flex flex-col items-center pt-6 pb-16">
        <div className="w-full max-w-[1280px] px-4 sm:px-8 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs tracking-widest text-[#9B2D26] font-semibold mb-1">
              <Feather className="size-3.5" />
              <span>CHINESE PUBLICATION TYPOGRAPHY · 3D WEBGL PAGER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#242220]">
              中文经典出版物 · 真实三维卷曲翻页系统
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#242220]/70 max-w-[500px] leading-relaxed">
            已彻底剥离所有静态外部图片，基于 2D 高清 Canvas 纯文本排印与思源宋体实时生成纹理，无缝驱动官方圆柱卷曲折痕物理着色器。
          </p>
        </div>

        {/* 3D 翻页书组件 */}
        <div className="w-full">
          <PaperMagazine />
        </div>

        {/* 技术实现细节卡片 */}
        <section className="w-full max-w-[1180px] px-4 sm:px-8 mt-16 pt-10 border-t border-[#E2DDD3]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 卡片 1 */}
            <div className="rounded-xl border border-[#242220]/10 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-2.5 text-sm font-bold text-[#242220]">
                <Type className="size-4 text-[#9B2D26]" />
                <h3>纯文本动态排印架构</h3>
              </div>
              <p className="text-xs text-[#242220]/75 leading-relaxed">
                无需预制图片，全书 16 页由排印引擎在离屏 1440×1983 超清画布上实时排版，包括正文首字下沉、首行缩进两全角字符、标点避头尾法则、朱砂印章与古籍天头地脚网格，并自动转为 GPU 纹理。
              </p>
            </div>

            {/* 卡片 2 */}
            <div className="rounded-xl border border-[#242220]/10 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-2.5 text-sm font-bold text-[#242220]">
                <Cpu className="size-4 text-[#9B2D26]" />
                <h3>100% 原版物理卷曲与折痕</h3>
              </div>
              <p className="text-xs text-[#242220]/75 leading-relaxed">
                保留 <code>paper.design/mono</code> 的完整 GLSL 顶点与片元着色器：基于 <code>uFold</code>/<code>uCurl</code> 圆柱坐标投影、有限差分法实时法线重构、FBM 褶皱烘焙，以及薄纸背面透光与微纤维粗糙度计算。
              </p>
            </div>

            {/* 卡片 3 */}
            <div className="rounded-xl border border-[#242220]/10 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-2.5 text-sm font-bold text-[#242220]">
                <Sparkles className="size-4 text-[#9B2D26]" />
                <h3>真实交互动力学与纸张音效</h3>
              </div>
              <p className="text-xs text-[#242220]/75 leading-relaxed">
                包含光标边缘拉扯曲率自适应跟随、脱手惯性 Hermite 速度阻尼、鼠标悬浮微翘（Peek 3%）、长按极速连翻加速（1.2s → 0.5s），并结合 Web Audio API 实时合成轻柔拟真的翻书沙沙声。
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="w-full border-t border-[#E2DDD3] py-6 px-4 text-center text-xs text-[#242220]/50">
        《文心雅集》中文经典文学排印与真实三维翻页引擎 · 纯文本实时排版渲染
      </footer>
    </div>
  );
}
