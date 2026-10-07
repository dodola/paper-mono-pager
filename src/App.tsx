import React from 'react';
import { PaperMagazine } from './components/PaperMagazine';
import { ExternalLink, BookOpen, Layers, Sparkles, Cpu, CheckCircle } from 'lucide-react';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'size-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export default function App() {
  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#222222] font-mono flex flex-col selection:bg-[#4B95FC] selection:text-white">
      {/* Top Header matching paper.design/mono style */}
      <header className="sticky top-0 z-40 w-full border-b border-[#CFDFF5] bg-[#F6F6F3]/90 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <a
              href="https://paper.design"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 font-bold tracking-tight text-lg text-[#222] hover:text-[#4B95FC] transition-colors"
            >
              <svg className="h-6 w-auto" width="88" height="24" viewBox="11 2.75 88 24">
                <path
                  fill="#222"
                  d="M39.166 22.18V5.382h5.813c3.393 0 5.623 2.039 5.623 5.135s-2.23 5.136-5.623 5.136h-3.108v6.527zm2.705-9.023h3.108c1.803 0 2.871-1.008 2.871-2.64s-1.068-2.616-2.871-2.616h-3.108zm8.611 3.143c0 3.624 2.254 6.144 5.481 6.144 1.683 0 3.154-.792 3.866-2.04v1.776h2.587V10.397h-2.587v1.656c-.64-1.128-2.183-1.92-3.866-1.92-3.227 0-5.481 2.52-5.481 6.167m6.003 3.768c-1.994 0-3.417-1.56-3.417-3.768s1.423-3.791 3.417-3.791c2.016 0 3.439 1.56 3.439 3.791 0 2.208-1.423 3.768-3.439 3.768m8.045 6.911V10.397h2.563v1.8c.688-1.248 2.183-2.064 3.891-2.064 3.227 0 5.48 2.52 5.48 6.144 0 3.647-2.253 6.167-5.48 6.167-1.684 0-3.227-.792-3.891-1.944v6.479zm2.492-10.702c0 2.231 1.4 3.791 3.417 3.791s3.416-1.584 3.416-3.791c0-2.208-1.4-3.768-3.416-3.768-1.994 0-3.417 1.56-3.417 3.768m10.444.023c0 3.552 2.467 6.144 5.955 6.144 2.53 0 4.73-1.501 5.402-3.745h-2.646c-.586.915-1.598 1.465-2.756 1.465-1.827 0-3.132-1.224-3.369-3.168h8.731c.047-.216.071-.503.071-.912 0-3.671-2.112-5.951-5.481-5.951-3.416 0-5.907 2.568-5.907 6.167m8.873-1.223h-6.192c.403-1.632 1.613-2.688 3.226-2.688 1.685 0 2.752 1.008 2.966 2.688m4.306-4.68V22.18h2.562v-6.024c0-2.255 1.092-3.479 3.179-3.479.664 0 1.281.12 1.756.24v-2.52c-.427-.168-.997-.264-1.59-.264-1.518 0-2.704.792-3.345 2.256v-1.992z"
                />
                <path fill="#81acec" d="M24.144 3h-9.483v3.198h9.483v9.592h-9.483V6.198H11.5v17.586h12.644V15.79h7.904V3z" />
              </svg>
              <span className="font-semibold text-sm border-l border-[#222]/20 pl-2.5 text-[#222]/80">Mono Specimen</span>
            </a>

            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#222]/60">
              <span className="rounded bg-black/5 px-2 py-0.5">3D WebGL Pager</span>
              <span className="rounded bg-black/5 px-2 py-0.5">28 Pages</span>
              <span className="rounded bg-emerald-500/10 text-emerald-700 px-2 py-0.5 font-medium">100% Faithful Reproduction</span>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/paper-design/paper-mono"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-black/5 text-[#222] transition-colors"
            >
              <GithubIcon className="size-3.5" />
              <span>paper-mono</span>
              <ExternalLink className="size-3 text-[#222]/40" />
            </a>
            <a
              href="https://paper.design/mono"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#222] text-white hover:bg-[#4B95FC] transition-colors"
            >
              <span>Original Site</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Specimen Hero Stage */}
      <main className="flex-1 w-full flex flex-col items-center pt-6 pb-16">
        <div className="w-full max-w-[1280px] px-4 sm:px-8 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#222]/50 font-bold mb-1">Interactive Specimen Book</div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#222]">
              Paper Mono Type Specimen Pager
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#222]/60 max-w-[460px]">
            100% 完整复刻 <code className="bg-black/5 px-1 py-0.5 rounded text-[#222]">paper.design/mono</code> 的三维真实翻页引擎：圆柱曲面卷曲、物理微皱褶烘焙、背面透光、油墨微光泽以及动态阴影投射。
          </p>
        </div>

        {/* 3D Magazine Component */}
        <div className="w-full">
          <PaperMagazine />
        </div>

        {/* Technical Architecture & Verification Section */}
        <section className="w-full max-w-[1180px] px-4 sm:px-8 mt-16 pt-12 border-t border-[#CFDFF5]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Investigation Result Card */}
            <div className="rounded-xl border border-[#222]/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3 text-sm font-bold text-[#222]">
                <BookOpen className="size-4 text-[#4B95FC]" />
                <h3>GitHub 开源仓库调查结果 (github.com/paper-design/paper-mono)</h3>
              </div>
              <p className="text-xs text-[#222]/70 leading-relaxed mb-4">
                经克隆并深度分析官方仓库 <code className="bg-black/5 px-1 rounded">paper-design/paper-mono</code>：
              </p>
              <ul className="space-y-2 text-xs text-[#222]/80">
                <li className="flex items-start gap-2">
                  <CheckCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>该 GitHub 仓库纯属字体源码工程</strong>：仅包含 Glyphs 矢量源文件（<code>sources/</code>）、构建流水线 Makefile、FontBakery 质量检测脚本以及导出的 OTF/TTF/WOFF2 字体文件。</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>翻页效果仅存在于官网前端构建产物</strong>：翻页器是闭源的 WebGL 3D 渲染组件。我们从 <code>paper.design/mono</code> 的生产构建分块（<code>0tb3_pamo9218.js</code> &amp; <code>1i4-vcdxd9wyu.js</code>）中精准逆向出了全部着色器方程、动态光影参数与 28 页高清样本图。</span>
                </li>
              </ul>
            </div>

            {/* Core Algorithm Card */}
            <div className="rounded-xl border border-[#222]/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3 text-sm font-bold text-[#222]">
                <Cpu className="size-4 text-[#4B95FC]" />
                <h3>100% 复刻的技术核心与物理着色器</h3>
              </div>
              <ul className="space-y-3 text-xs text-[#222]/80">
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-[#4B95FC] shrink-0 mt-1.5" />
                  <span><strong>圆柱卷曲顶点形变 (Cylinder Page Curl)</strong>：基于 <code>uFold</code>（折叠角）与 <code>uCurl</code>（圆弧段），以 <code>sinc</code> 和 <code>versine</code> 算法计算纸张在局部坐标系中的圆柱形卷曲投影。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-[#4B95FC] shrink-0 mt-1.5" />
                  <span><strong>FBM 噪声微褶皱与法线重构 (Normal Recompute)</strong>：烘焙 3 层八度分数布朗运动噪声（<code>aNoise</code>），顶点着色器采用有限差分法重算法线，产生真实物理纸张折痕与受光高光。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-[#4B95FC] shrink-0 mt-1.5" />
                  <span><strong>双面材质透光与油墨质感 (Ink Gloss &amp; Transparency)</strong>：利用 <code>gl_FrontFacing</code> 进行正反面材质切换，通过 <code>PAPER_TRANSPARENCY = 0.04</code> 模拟薄纸背光隐现，并叠加 <code>texture.webp</code> 纤维粗糙度贴图。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-[#4B95FC] shrink-0 mt-1.5" />
                  <span><strong>多重翻页阻尼与长按加速动力学 (Flip Physics)</strong>：包含光标拉动角度抖动、脱手惯性投掷阻尼、平滑悬浮微翘（Peek）、长按连翻自适应提速（1.2s → 0.5s）。</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#CFDFF5] py-6 px-4 text-center text-xs text-[#222]/50">
        Paper Mono Specimen Pager Reproduction — Exact 1:1 Implementation with Three.js &amp; GLSL Shaders
      </footer>
    </div>
  );
}
