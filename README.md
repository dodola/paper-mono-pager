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

## 🚀 快速启动

### 1. 克隆项目
```bash
git clone https://github.com/dodola/paper-mono-pager.git
cd paper-mono-pager
```

### 2. 安装依赖
```bash
npm install
```

### 3. 本地开发
```bash
npm run dev
```
打开浏览器访问 `http://localhost:3000` 即可体验。

### 4. 生产打包
```bash
npm run build
```

---

## 📖 目录说明

```text
paper-mono-pager/
├── src/
│   ├── components/
│   │   ├── PaperMagazine.tsx           # React 主界面与控制台吸底胶囊组件
│   │   └── magazine/
│   │       ├── MagazineEngine.ts       # 核心 3D 翻页物理引擎与交互调度
│   │       ├── shaders.ts              # 官方复刻 GLSL 顶点/片元着色器
│   │       ├── noiseBaker.ts           # 纸张网格几何体与噪声烘焙器
│   │       ├── pageRenderer.ts         # 纯文本 Canvas 2D 出版级排版渲染器
│   │       ├── chinesePublicationData.ts # 16 页中文古籍文集数据
│   │       ├── pageSound.ts            # Web Audio 翻页纸张音效
│   │       └── types.ts                # 物理交互与动画状态类型
│   ├── App.tsx                         # 顶层布局应用
│   ├── main.tsx                        # 入口与字体全局加载
│   └── index.css                       # 全局样式配置
├── public/                             # 静态纹理资源
├── package.json
└── vite.config.ts
```

---

## 👏 致敬与致谢

- 3D 翻页物理卷曲与着色器灵感源自：[Paper Design (paper.design/mono)](https://paper.design/mono)
- 优美中文字体感谢：[落霞孤鹜 (LXGW) - 霞鹜文楷](https://github.com/lxgw/LxgwWenKai)

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 授权许可。
