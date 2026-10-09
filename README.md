# 📖 Paper Mono Pager — 霞鹜文楷 3D 物理翻页书

[![Demo](https://img.shields.io/badge/Demo-在线演示-success.svg)](https://dodola.github.io/paper-mono-pager/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r180-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Font](https://img.shields.io/badge/Font-LXGW_WenKai-9B2D26.svg)](https://github.com/lxgw/LxgwWenKai)

> 🔗 **在线演示 (Demo)**: [https://dodola.github.io/paper-mono-pager/](https://dodola.github.io/paper-mono-pager/)
> 
> 极致复刻 [paper.design/mono](https://paper.design/mono) 的 3D WebGL 物理真实卷曲翻页算法，结合中文出版物经典网格排印与开源中文字体 **霞鹜文楷（LXGW WenKai）**，实现纯文本实时渲染的典藏级数字古籍阅读体验。

---

## ✨ 核心特性

- 📜 **100% 还原纸张物理卷曲算法**
  - 基于 Three.js 自定义 GLSL 着色器，圆柱坐标几何弯曲投影与曲率微扰；
  - 烘焙 FBM 噪声顶点置换（`aNoise`），模拟真实纸张翻折微褶皱；
  - 有限差分法（Finite Difference）动态法线重构，配合背光半透光（Translucency）与纸张油墨高光；
  - 惯性阻尼手势拖拽、边缘角部卷起（Corner Roll）、自然回弹与快速连续翻页（Quick Auto-flip）。
- 🖋️ **纯文本 Canvas 2D 动态出版排印架构**
  - 彻底去除静态图片切片依赖，全书 16 页内容由矢量 Canvas 2D 实时光栅化为超清 GPU 纹理（$1440 \times 1983$）；
  - 经典中文版心法度：含题签装帧、扉页题记、目录点划线、章节题扉、散文对开页、优美诗歌居中、双色套印、朱砂印章、避头尾折行算法与封底 CIP 版权页。
- 🏮 **集成开源中文字体「霞鹜文楷」**
  - 引入落霞孤鹜开源中文字体 [LXGW WenKai](https://github.com/lxgw/LxgwWenKai)；
  - 客户端自动化 WOFF2 切片加载与异步预热重绘机制，字形温润古雅。
- 🎨 **多重宣纸主题与视听交互**
  - 支持「古籍米宣」、「竹青素白」、「暖调象牙」、「怀旧古纸」四套纸张质感主题实时换肤；
  - Web Audio 合成自然纸张翻阅沙沙音效；
  - 支持键盘快捷翻页（`←`/`→`、`Space`、`PgUp`/`PgDn`、`Home`）；
  - 智能自适应全屏布局，底部控制胶囊吸底，书籍画幅自动最大化贴合窗口。
- 📱 **小屏幕单页堆叠模式**
  - 视口宽度 < 1024px 或竖屏时自动切换为独立的单页引擎（可用 `singlePageQuery` 属性自定义媒体查询，默认 `(max-width: 1023px), (orientation: portrait)`，让平板、小窗口尽量保持单页）：一次一页，纸张以「一摞单张纸」堆叠，翻起的页绕书脊卷成锥形；
  - 相机按固定画框（宽高比 0.65）反算 fov，画布层放大 1.3 倍，竖屏下书页铺满宽度；
  - 触摸手势：横向滑动翻页（纵向留给页面滚动）、点击翻一页、按住连翻（越翻越快）；跨多页跳转会逐张翻过去；翻完最后一页回到首页；
  - 形变与参考实现数值一致：堆叠抬升 → 尾部弯曲 → 锥形卷起 → 绕书脊旋转，以及翻完整本后的「卷起收尾」，`referenceParity.test.ts` 用参考实现实际送入着色器的参数做回归；
  - 鼠标 / 触控笔在窄屏下可选字、划线、右键菜单；触摸始终归翻页，暂未提供触摸选字；排印编辑器依赖桌面双页坐标，仅宽屏可用；
  - 跨过断点时自动重建引擎，并在两个方向都保持当前阅读页。
- 🖼️ **图片：整页图片与图文混排**
  - 整页图片：`PageContent.imageUrl` 让一页直接显示一张图（对应原版 paper.design/mono 的整页位图，`imageFit` 可选 `cover` 铺满裁切 / `contain` 完整留白）；
  - 图文混排：`PageContent.figures` 把插图嵌进散文页 / 扉页 / 章节页的正文流，可指定插在第几段之前、高度、适配方式与图注，后续段落自动下移，编辑、选字、搜索的坐标同步跟随；
  - 图片与文字一样被光栅化进同一张页面纹理，因此卷曲、纸纹、背光等效果对图片同样生效；图片异步加载，就绪前显示占位。
- ✍️ **实时排印编辑模式 (WYSIWYG Edit Mode)**
  - 支持左侧分栏抽屉实时编辑全书 16 页图文内容（标题、副标题、著者、版心正文、诗歌行、目录条目、CIP 版权明细、朱砂印章）；
  - 毫秒级单页局部光栅化重绘，3D 纸张纹理实时所见即所得同步；
  - 支持页面版式自由切换、单页/全书一键恢复默认、全书 JSON 导入导出与快速翻阅。

---

## 🛠️ 技术栈

- **渲染引擎**: [Three.js](https://threejs.org/) + 自定义 GLSL Vertex & Fragment Shaders
- **前端框架**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite 6](https://vitejs.dev/)
- **样式方案**: [Tailwind CSS v4](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **中文字体**: [lxgw-wenkai-webfont](https://github.com/lxgw/LxgwWenKai)
- **音效合成**: Web Audio API

---

## 📦 作为组件库使用

> 暂未发布到 npm，目前通过源码接入（参考 `examples/demo`：在 Vite 中把 `paper-mono-pager` 别名到 `packages/paper-mono-pager/src/index.ts`，或作为 workspace 依赖引用）。发布后即可按下面方式安装。

```bash
npm install paper-mono-pager react react-dom lxgw-wenkai-webfont
```

```tsx
import { PaperMagazine } from 'paper-mono-pager';
import 'paper-mono-pager/style.css';        // 组件样式（不含 reset，不会污染宿主页面）
import 'lxgw-wenkai-webfont/style.css';     // 可选：霞鹜文楷字体，不引入则回退到系统衬线体

export default function Page() {
  return (
    <div style={{ height: '100vh' }}>
      <PaperMagazine />   {/* 填满父容器，父容器需要有明确高度 */}
    </div>
  );
}
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pages` | `PageContent[]` | 内置 16 页中文文集 | 书本内容。页数在挂载时确定，之后可替换内容但不能增减页数 |
| `onPagesChange` | `(pages) => void` | - | 编辑、重置、导入后触发 |
| `onPageChange` | `(info) => void` | - | 翻页后触发，`info` 含 `sheet / totalSheets / leftPage / rightPage` |
| `themes` | `PaperTheme[]` | 四套宣纸主题 | 自定义纸张主题 `{ name, bg, text, accent }` |
| `defaultThemeIndex` | `number` | `0` | 初始主题 |
| `patternUrl` | `string` | 内置纹理 | 自定义纸张纹理图 |
| `initialPage` | `number` | `0` | 初始显示的页（从 0 起，含该页的对开页/单页），直接落在那里，不会先显示封面 |
| `keyboard` | `boolean` | `true` | 是否在 `window` 上绑定翻页快捷键（`←`/`→`、空格、`PgUp`/`PgDn`、`Home`/`End`）。宿主要用这些键（如空格播放/暂停）时设为 `false`，翻页改用 ref 方法 |
| `reader` | `boolean` | `true` | 是否启用阅读器（选字复制、划线、搜索、书签、右键菜单及浮层，以及 `Ctrl+C/A/F/D` 等快捷键）。设为 `false` 不创建阅读器，也不监听 `window` 的指针/滚轮/按键；变化会重建渲染引擎（阅读位置保留） |
| `editable` | `boolean` | `true` | 是否提供排印编辑功能 |
| `showControls` | `boolean` | `true` | 是否显示底部控制栏与页码条 |
| `isEditMode` / `onToggleEditMode` | `boolean` / `(mode) => void` | 内部管理 | 受控编辑模式 |
| `defaultSoundEnabled` | `boolean` | `true` | 翻页音效初始状态 |
| `autoPlay` / `autoPlayInterval` | `boolean` / `number` | `false` / `2800` | 自动连读 |
| `className` / `style` | - | - | 外层容器样式 |

通过 `ref` 可命令式控制：

```tsx
const ref = useRef<PaperMagazineHandle>(null);
<PaperMagazine ref={ref} />;
ref.current?.flipNext();      // flipPrev / goToSheet(n) / goToPage(i) / getPages()
ref.current?.jumpToPage(119); // 瞬间跳页：无翻页动画、无翻页音，适合目录 / 进度条 / 音频同步
```

| 方法 | 说明 |
|------|------|
| `flipNext()` / `flipPrev()` | 向后 / 向前翻一页（带动画与音效） |
| `goToPage(i)` / `goToSheet(n)` | 翻到目标位置（带动画与音效）。距离不超过 6 张纸时逐张翻；更远则先静默落到目标前 6 张，只翻最后几张，不会在长书里翻上十几秒 |
| `jumpToPage(i)` / `jumpToSheet(n)` | **瞬间**到达，完全没有动画和音效，只绘制目标附近的页。`onPageChange` 照常触发 |
| `getPages()` | 当前页面内容 |

> 页序号 `i` 从 0 起；`jumpToSheet` 的 `n` 在双页布局是对开页序号（0 = 封面），单页布局即页序号。

### 长书与内存

双页引擎只为当前对开页前后各 2 张纸（约 12 页）持有页面纹理，其余页翻到时才绘制、离开后释放；单页引擎同理。常驻内存只取决于这个窗口，与全书页数无关（140 页的书与 16 页的书占用相当）。紧邻当前页的纹理同步绘制，更远的在空闲时补齐。

自定义内容示例：

```tsx
import { PaperMagazine, type PageContent } from 'paper-mono-pager';

const pages: PageContent[] = [
  { type: 'cover', sideIndex: 1, title: '我的书', subtitle: '副标题', author: '作者' },
  // ... type 可选 cover | frontispiece | toc | chapter | spread | poetry | colophon
];
<PaperMagazine pages={pages} />;
```

图片页与图文混排：

```tsx
const pages: PageContent[] = [
  // 整页图片：该页不再绘制文字，也不可选中/编辑
  { type: 'spread', sideIndex: 2, title: '插页', imageUrl: '/art/plate-01.png', imageFit: 'cover' },
  // 图文混排：figures 嵌入正文流（仅 spread / frontispiece / chapter 页）
  {
    type: 'spread', sideIndex: 3, title: '赤壁夜泛',
    paragraphs: ['第一段……', '第二段……'],
    figures: [{ url: '/art/chibi.jpg', beforeParagraph: 1, height: 420, caption: '图一 · 赤壁夜泛' }],
  },
];
```

> 图片会被绘入 Canvas 再上传为 WebGL 纹理，所以跨域图片需服务端返回 `Access-Control-Allow-Origin`（组件以 `crossOrigin="anonymous"` 请求），否则无法显示。`figures` 中 `beforeParagraph` 缺省 = 全部正文之后；插图不会自动分页，请自行控制高度避免与页脚注释重叠。

> 需要 WebGL 支持；组件仅在浏览器端运行，SSR 框架（Next.js 等）请用动态导入并关闭 SSR。

---

## 🚀 本地开发

本仓库是 npm workspaces 单仓：

```bash
git clone https://github.com/dodola/paper-mono-pager.git
cd paper-mono-pager
npm install
npm run dev        # 启动 demo（http://localhost:3000），demo 直接引用组件库源码，改动即时热更新
npm test           # 运行组件库单元测试
npm run build      # 构建 demo
npm run build:lib  # 单独构建组件库产物（暂未发布 npm）
```

---

## 📖 目录说明

```text
paper-mono-pager/
├── packages/paper-mono-pager/      # 组件库（发布为 npm 包 paper-mono-pager）
│   └── src/
│       ├── index.ts                # 对外导出入口
│       ├── PaperMagazine.tsx       # React 主组件与控制条
│       ├── styles.css              # 组件样式入口（Tailwind theme + utilities）
│       ├── assets/texture.webp     # 内置纸张纹理（构建时内联）
│       └── magazine/               # 3D 引擎、着色器、Canvas 排印渲染、阅读器、编辑器
│           └── mobile/             # 小屏单页堆叠引擎（mobileModel 纯逻辑 + 着色器 + 引擎）
├── examples/demo/                  # 通过 `import 'paper-mono-pager'` 接入的示例应用
└── scripts/                        # 资源辅助脚本
```

---

## 👏 致敬与致谢

- 3D 翻页物理卷曲与着色器灵感源自：[Paper Design (paper.design/mono)](https://paper.design/mono)
- 优美中文字体感谢：[落霞孤鹜 (LXGW) - 霞鹜文楷](https://github.com/lxgw/LxgwWenKai)

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 授权许可。
