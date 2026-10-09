import * as THREE from 'three';
import { PageContent } from '../chinesePublicationData';
import { renderPageBase, RenderOptions } from '../pageRenderer';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../pageLayout';
import { paintReaderOverlay, ReaderPageOverlay } from '../reader/overlayPainter';
import type { ReaderEngineHost } from '../reader/engineHost';
import {
  MAP_FRAGMENT,
  ROUGHNESS_FRAGMENT,
  OPAQUE_FRAGMENT,
  NORMAL_FRAGMENT,
} from '../shaders';
import {
  MOBILE_VERTEX_DECLARATIONS,
  MOBILE_NORMAL_RECOMPUTE,
  MOBILE_DEPTH_VERTEX_POSITION,
  MOBILE_FRAGMENT_HEADER,
  MOBILE_SHADOW_INTENSITY,
} from './mobileShader';
import {
  MOBILE_CAMERA_Z,
  MOBILE_LAYER_SCALE,
  MOBILE_SHEET_ASPECT,
  MOBILE_TUNING,
  bookOffset,
  buildCatchUp,
  buildRadiusSpacing,
  claimsHorizontalSwipe,
  commitTarget,
  computeSheetShape,
  dragProgress,
  flipEase,
  holdTiming,
  mobileFov,
  mobileFrameCenter,
  sheetRenderOrder,
  sheetVisible,
} from './mobileModel';

export interface MobileMagazineOptions {
  container: HTMLElement;
  pageContents: PageContent[];
  patternUrl?: string;
  renderOptions?: RenderOptions;
  /** 起始页（0 起），用于从桌面布局切换过来时保持阅读位置 */
  initialIndex?: number;
  /** left 恒为 null：移动端一次只看一页 */
  onPageChange?: (currentSheet: number, left: number | null, right: number | null) => void;
  onProgress?: (loaded: number, total: number) => void;
  onReady?: () => void;
}

interface Wobble {
  tiltDeg: number;
  flipTime: number;
}

interface MobileSheet {
  index: number;
  mesh: THREE.Mesh;
  uniforms: SheetUniforms;
  flipProgress: number;
  grabX: number;
  grabXTarget: number;
  grabY: number;
  grabYTarget: number;
  wobble: Wobble;
}

interface SheetUniforms {
  uPileLift: { value: THREE.Vector3 };
  uPileReach: { value: THREE.Vector2 };
  uConeTaper: { value: number };
  uTailCurl: { value: THREE.Vector4 };
  uTailBend: { value: number };
  uCone: { value: THREE.Vector3 };
  uFlipRotation: { value: THREE.Vector2 };
  uPatternTex: { value: THREE.Texture };
  uBackMap: { value: THREE.Texture };
}

interface Animation {
  sheet: MobileSheet;
  from: number;
  to: number;
  startTime: number;
  duration: number;
  launch?: number;
}

interface Drag {
  sheet: MobileSheet;
  forward: boolean;
  base: number;
  progress: number;
  rectWidth: number;
  speed: number;
}

interface Hold {
  forward: boolean;
  x: number;
  y: number;
  count: number;
  fired: boolean;
  timer: ReturnType<typeof setTimeout>;
}

const HALF_H = MOBILE_SHEET_ASPECT / 2;
/** 当前页前后保留纹理的页数（相对渲染深度再留的余量） */
const TEXTURE_BEHIND = 2;
const TEXTURE_AHEAD_EXTRA = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export class MobileMagazineEngine implements ReaderEngineHost {
  private container: HTMLElement;
  private pageContents: PageContent[];
  private patternUrl?: string;
  private renderOptions: RenderOptions;
  private onPageChange?: MobileMagazineOptions['onPageChange'];
  private onProgress?: MobileMagazineOptions['onProgress'];
  private onReady?: () => void;

  private scene = new THREE.Scene();
  private book = new THREE.Group();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private abort = new AbortController();
  private resizeObserver: ResizeObserver;
  private intersection: IntersectionObserver;

  private count: number;
  /** 已翻过的页数，同时也是当前可见页的序号 */
  private current: number;
  private sheets: MobileSheet[] = [];
  private animations: Animation[] = [];
  private drag: Drag | null = null;
  private pointerStart: { x: number; y: number } | null = null;
  private hold: Hold | null = null;
  /** 跨多页跳转时逐张翻动的定时器 */
  private chainTimer: ReturnType<typeof setTimeout> | null = null;
  private touch: { x: number; y: number; claimed: boolean } | null = null;

  private pageTextures: (THREE.CanvasTexture | undefined)[] = [];
  /** 阅读层（选区、划线、搜索、书签）直接绘进页面纹理 */
  private pageReaderOverlays: Record<number, ReaderPageOverlay | null> = {};
  /** 只为带阅读层的页缓存不含覆盖层的底图，其余页纹理直接用底图画布 */
  private pageBases: Record<number, HTMLCanvasElement> = {};
  private pageCanvases: Record<number, HTMLCanvasElement> = {};
  private pointerInterceptor: ((e: PointerEvent) => boolean) | null = null;
  private patternTexture: THREE.Texture | null = null;
  private placeholderTex: THREE.DataTexture;
  private blackTex: THREE.DataTexture;

  private catchUpMap: number[];
  private radii: number[];

  private needsRender = true;
  private lastFrameTime = 0;
  private isVisible = true;
  private isReady = false;
  private isDisposed = false;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hit = new THREE.Vector3();
  private spine = new THREE.Vector3();

  constructor(options: MobileMagazineOptions) {
    this.container = options.container;
    this.pageContents = [...options.pageContents];
    this.patternUrl = options.patternUrl;
    this.renderOptions = options.renderOptions ?? {};
    this.onPageChange = options.onPageChange;
    this.onProgress = options.onProgress;
    this.onReady = options.onReady;

    this.count = this.pageContents.length;
    this.current = clamp(Math.trunc(options.initialIndex ?? 0), 0, Math.max(this.count - 1, 0));
    this.catchUpMap = buildCatchUp(this.count);
    this.radii = buildRadiusSpacing(this.count);

    const c = mobileFrameCenter();
    this.camera = new THREE.PerspectiveCamera(mobileFov(), 2, 1.5, 4.5);
    this.camera.position.set(c.x, c.y, MOBILE_CAMERA_Z);
    this.camera.lookAt(c.x, c.y, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    this.canvas = this.renderer.domElement;
    this.canvas.dataset.magazineLayer = '';
    this.canvas.style.cssText =
      `display:block;position:absolute;inset:0;width:100%;height:100%;transform:scale(${MOBILE_LAYER_SCALE});` +
      'transform-origin:50% 50%;touch-action:pan-y pinch-zoom;' +
      '-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;';
    this.container.appendChild(this.canvas);

    this.scene.add(this.book);
    this.addLights();

    const solid = (r: number, g: number, b: number) => {
      const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
      t.needsUpdate = true;
      return t;
    };
    this.blackTex = solid(0, 0, 0);
    this.placeholderTex = solid(252, 252, 249);
    this.placeholderTex.colorSpace = THREE.SRGBColorSpace;

    this.createSheets();
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.handleResize();

    this.intersection = new IntersectionObserver(
      (entries) => {
        this.isVisible = entries[entries.length - 1].isIntersecting;
        this.updateLoop();
      },
      { rootMargin: '50% 0px' }
    );
    this.intersection.observe(this.container);

    this.loadPattern();
    this.syncTextures();
    this.isReady = true;
    this.onReady?.();

    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (!this.isDisposed) this.rebuildTextures();
      });
    }
    document.addEventListener('visibilitychange', this.updateLoop, { signal: this.abort.signal });
    this.updateLoop();
  }

  // ---------- 场景搭建 ----------

  private addLights() {
    const lights = new THREE.Group();
    this.scene.add(lights);
    lights.add(new THREE.HemisphereLight('#ffffff', '#a1aeaf', 1.7));

    const sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.set(0.689, -1.15, 2.15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -1.1;
    sun.shadow.camera.right = 1.1;
    sun.shadow.camera.top = 0.8;
    sun.shadow.camera.bottom = -0.8;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 10;
    sun.shadow.bias = -0.001;
    sun.shadow.intensity = MOBILE_SHADOW_INTENSITY;
    lights.add(sun);
    lights.add(sun.target);
  }

  private createSheets() {
    const geometry = new THREE.PlaneGeometry(1, MOBILE_SHEET_ASPECT, 64, 88);
    geometry.deleteAttribute('normal');

    for (let i = 0; i < this.count; i++) {
      const uniforms: SheetUniforms = {
        uPileLift: { value: new THREE.Vector3(1, 0, 0) },
        uPileReach: { value: new THREE.Vector2(1, 1) },
        uConeTaper: { value: 0 },
        uTailCurl: { value: new THREE.Vector4(1, 0, 1, 1) },
        uTailBend: { value: 0 },
        uCone: { value: new THREE.Vector3(0, 1, 0) },
        uFlipRotation: { value: new THREE.Vector2(1, 0) },
        uPatternTex: { value: this.blackTex },
        uBackMap: { value: this.placeholderTex },
      };

      const material = new THREE.MeshStandardMaterial({
        map: this.placeholderTex,
        side: THREE.DoubleSide,
        metalness: 0.17,
        roughness: 0.5,
      });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = MOBILE_VERTEX_DECLARATIONS + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>\n{\n${MOBILE_NORMAL_RECOMPUTE}\nobjectNormal = surfaceNormal;\n}\n`
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          'vec3 transformed = _transformedSheetPosition;\nvGrainUv = uv;\n'
        );
        shader.fragmentShader = MOBILE_FRAGMENT_HEADER + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', NORMAL_FRAGMENT);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', MAP_FRAGMENT);
        shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', ROUGHNESS_FRAGMENT);
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', OPAQUE_FRAGMENT);
      };

      const depthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        side: THREE.DoubleSide,
      });
      depthMaterial.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = MOBILE_VERTEX_DECLARATIONS + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `${MOBILE_DEPTH_VERTEX_POSITION}\nvec3 transformed = _transformedSheetPosition - vec3(SHADOW_OFFSET_X, 0., 0.);\n`
        );
      };

      const mesh = new THREE.Mesh(geometry, material);
      mesh.customDepthMaterial = depthMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.book.add(mesh);

      this.sheets.push({
        index: i,
        mesh,
        uniforms,
        flipProgress: i < this.current ? 1 : 0,
        grabX: 1,
        grabXTarget: 1,
        grabY: 0,
        grabYTarget: 0,
        wobble: { tiltDeg: 0, flipTime: 1 },
      });
    }
  }

  private loadPattern() {
    const apply = (tex: THREE.Texture) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.patternTexture = tex;
      for (const s of this.sheets) s.uniforms.uPatternTex.value = tex;
      this.renderer.initTexture(tex);
      this.needsRender = true;
    };
    if (this.patternUrl) {
      new THREE.TextureLoader().load(
        this.patternUrl,
        (tex) => (this.isDisposed ? tex.dispose() : apply(tex)),
        undefined,
        () => apply(this.proceduralPattern())
      );
    } else {
      apply(this.proceduralPattern());
    }
  }

  private proceduralPattern(): THREE.Texture {
    const size = 384;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.floor(Math.random() * 50);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
  }

  // ---------- 页面纹理（按当前页前后窗口懒生成） ----------

  private textureWindow(): [number, number] {
    const lo = Math.max(0, this.current - TEXTURE_BEHIND);
    const hi = Math.min(this.count - 1, this.current + MOBILE_TUNING.onPile.renderDepth + TEXTURE_AHEAD_EXTRA);
    return [lo, hi];
  }

  private buildTexture(pageIndex: number) {
    const page = this.pageContents[pageIndex];
    if (!page) return;
    const tex = new THREE.CanvasTexture(this.composePage(pageIndex, renderPageBase(page, this.renderOptions)));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.renderer.initTexture(tex);
    this.pageTextures[pageIndex]?.dispose();
    this.pageTextures[pageIndex] = tex;

    const material = this.sheets[pageIndex]?.mesh.material as THREE.MeshStandardMaterial | undefined;
    if (material) {
      material.map = tex;
      material.needsUpdate = true;
    }
    this.needsRender = true;
  }

  /** 底图 + 阅读层 → 纹理画布；没有阅读层时直接用底图 */
  private composePage(pageIndex: number, base: HTMLCanvasElement): HTMLCanvasElement {
    const page = this.pageContents[pageIndex];
    const overlay = this.pageReaderOverlays[pageIndex];
    if (!page || !overlay) {
      delete this.pageBases[pageIndex];
      delete this.pageCanvases[pageIndex];
      return base;
    }
    this.pageBases[pageIndex] = base;
    let canvas = this.pageCanvases[pageIndex];
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = base.width;
      canvas.height = base.height;
      this.pageCanvases[pageIndex] = canvas;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    paintReaderOverlay(ctx, page, pageIndex, overlay, this.renderOptions.accentColor ?? '#9B2D26');
    return canvas;
  }

  private syncTextures() {
    const [lo, hi] = this.textureWindow();
    for (let i = lo; i <= hi; i++) if (!this.pageTextures[i]) this.buildTexture(i);
    // 窗口外再留一段余量才释放，避免来回翻页时反复生成
    for (let i = 0; i < this.pageTextures.length; i++) {
      if (!this.pageTextures[i] || (i >= lo - 2 && i <= hi + 2)) continue;
      this.pageTextures[i]!.dispose();
      this.pageTextures[i] = undefined;
      delete this.pageBases[i];
      delete this.pageCanvases[i];
      const material = this.sheets[i]?.mesh.material as THREE.MeshStandardMaterial | undefined;
      if (material) {
        material.map = this.placeholderTex;
        material.needsUpdate = true;
      }
    }
    this.onProgress?.(Math.min(hi + 1, this.count), this.count);
  }

  private rebuildTextures() {
    this.pageTextures.forEach((t, i) => t && this.buildTexture(i));
  }

  public renderAllPageTextures(customOptions?: RenderOptions) {
    if (customOptions) this.renderOptions = { ...this.renderOptions, ...customOptions };
    this.rebuildTextures();
  }

  public updatePageContent(pageIndex: number, newContent: PageContent) {
    if (pageIndex < 0 || pageIndex >= this.count) return;
    this.pageContents[pageIndex] = newContent;
    if (this.pageTextures[pageIndex]) this.buildTexture(pageIndex);
  }

  public setAllPageContents(newContents: PageContent[]) {
    this.pageContents = [...newContents];
    this.rebuildTextures();
  }

  // ---------- 对外状态 ----------

  public getCurrentSheet(): number {
    return this.current;
  }

  public getTotalSheets(): number {
    return this.count;
  }

  public getContainer(): HTMLElement {
    return this.container;
  }

  public isFlipping(): boolean {
    return this.animations.length > 0 || this.drag !== null;
  }

  // ---------- 阅读器接口（ReaderEngineHost） ----------

  public getHitArea(): HTMLElement {
    return this.canvas;
  }

  public isEditing(): boolean {
    return false;
  }

  public setPointerInterceptor(fn: ((e: PointerEvent) => boolean) | null) {
    this.pointerInterceptor = fn;
  }

  public setPageReaderOverlay(pageIndex: number, overlay: ReaderPageOverlay | null) {
    if (pageIndex < 0 || pageIndex >= this.count) return;
    if (overlay) this.pageReaderOverlays[pageIndex] = overlay;
    else delete this.pageReaderOverlays[pageIndex];

    const tex = this.pageTextures[pageIndex];
    const page = this.pageContents[pageIndex];
    if (!tex || !page) return;
    const base = this.pageBases[pageIndex] ?? renderPageBase(page, this.renderOptions);
    tex.image = this.composePage(pageIndex, base);
    tex.needsUpdate = true;
    this.needsRender = true;
  }

  public getLeftPageIndex(): number | null {
    return null;
  }

  public getRightPageIndex(): number | null {
    return this.current < this.count ? this.current : null;
  }

  /** 屏幕坐标 → 当前页的纹理像素坐标；翻页进行中纹理与屏幕不对应，返回 null */
  public getCanvasCoordsFromClient(clientX: number, clientY: number) {
    const pageIndex = this.getRightPageIndex();
    if (pageIndex === null || this.isFlipping()) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const pt = this.planePoint(clientX, clientY);
    if (!pt || pt.x < 0 || pt.x > 1 || pt.y < -HALF_H || pt.y > HALF_H) return null;
    return {
      pageIndex,
      side: 'right' as const,
      canvasX: pt.x * CANVAS_WIDTH,
      canvasY: ((HALF_H - pt.y) / MOBILE_SHEET_ASPECT) * CANVAS_HEIGHT,
    };
  }

  /** 纹理像素坐标 → 屏幕坐标（把 IME 候选窗定位到光标处） */
  public getClientCoordsFromCanvas(pageIndex: number, canvasX: number, canvasY: number) {
    if (pageIndex !== this.getRightPageIndex()) return null;
    const v = new THREE.Vector3(
      canvasX / CANVAS_WIDTH + this.book.position.x,
      HALF_H - (canvasY / CANVAS_HEIGHT) * MOBILE_SHEET_ASPECT + this.book.position.y,
      this.book.position.z
    ).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  private notifyPageChange() {
    // 翻过最后一张到回到首页之间 current 会短暂等于 count，此时仍报告最后一页
    const page = Math.min(this.current, Math.max(this.count - 1, 0));
    this.onPageChange?.(page, null, page + 1);
  }

  // ---------- 翻页 ----------

  private isAnimating(sheet: MobileSheet) {
    return this.animations.some((a) => a.sheet === sheet);
  }

  private randomWobble(): Wobble {
    const w = MOBILE_TUNING.onWobble;
    const r = (a: number, b: number) => a + (b - a) * Math.random();
    return { tiltDeg: r(-w.tiltDeg, w.tiltDeg), flipTime: r(w.flipTimeMin, w.flipTimeMax) };
  }

  /** 把翻页方向和落点折算成当前页的变化 */
  private turn(forward: boolean, target: 0 | 1) {
    const delta = forward && target === 1 ? 1 : !forward && target === 0 ? -1 : 0;
    if (!delta) return;
    this.current += delta;
    this.syncTextures();
    this.needsRender = true;
    this.notifyPageChange();
  }

  private startFlip(sheet: MobileSheet, forward: boolean, target: 0 | 1, flipTime: number) {
    this.turn(forward, target);
    const from = sheet.flipProgress;
    const duration = 1000 * flipTime * sheet.wobble.flipTime * Math.max(0.2, Math.abs(target - from));
    this.animations = this.animations.filter((a) => a.sheet !== sheet);
    this.animations.push({ sheet, from, to: target, startTime: performance.now(), duration });
    this.needsRender = true;
    this.updateLoop();
  }

  private flipBy(forward: boolean) {
    const sheet = this.sheets[forward ? this.current : this.current - 1];
    if (!sheet) return;
    if (!this.isAnimating(sheet)) sheet.wobble = this.randomWobble();
    this.setGrab(sheet, { x: 1, y: 0 }, true);
    this.startFlip(sheet, forward, forward ? 1 : 0, MOBILE_TUNING.onClick.flipTime);
  }

  public flipNext() {
    this.flipBy(true);
  }

  public flipPrev() {
    this.flipBy(false);
  }

  /** 相邻页翻一张；跨多页时按「按住连翻」的节奏逐张翻过去，越翻越快 */
  public goToSheet(index: number) {
    const target = clamp(Math.trunc(index), 0, Math.max(this.count - 1, 0));
    this.cancelChain();
    if (target === this.current) return;
    if (Math.abs(target - this.current) === 1) {
      this.flipBy(target > this.current);
      return;
    }
    let count = 0;
    const step = () => {
      this.chainTimer = null;
      if (this.isDisposed || target === this.current) return;
      const forward = target > this.current;
      const sheet = this.sheets[forward ? this.current : this.current - 1];
      if (!sheet) return;
      if (!this.isAnimating(sheet)) sheet.wobble = this.randomWobble();
      this.setGrab(sheet, { x: 1, y: 0 }, true);
      const timing = holdTiming(count++);
      this.startFlip(sheet, forward, forward ? 1 : 0, timing.flipTime);
      this.chainTimer = setTimeout(step, 1000 * timing.gap);
    };
    step();
  }

  private cancelChain() {
    if (this.chainTimer) {
      clearTimeout(this.chainTimer);
      this.chainTimer = null;
    }
  }

  public goToPage(pageIndex: number) {
    this.goToSheet(pageIndex);
  }

  // ---------- 指针 / 触摸 ----------

  private setGrab(sheet: MobileSheet, pt: { x: number; y: number } | null, immediate: boolean) {
    if (!pt) return;
    sheet.grabXTarget = Math.min(Math.abs(pt.x), 1);
    sheet.grabYTarget = clamp(pt.y / HALF_H, -1, 1);
    if (immediate) {
      sheet.grabX = sheet.grabXTarget;
      sheet.grabY = sheet.grabYTarget;
    }
  }

  /** 屏幕点 → 书页平面上的点（相对书脊） */
  private planePoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(2 * ((clientY - rect.top) / rect.height)) + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.plane.constant = -this.book.position.z;
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hit)) return null;
    return { x: this.hit.x - this.book.position.x, y: this.hit.y - this.book.position.y };
  }

  private moved(e: PointerEvent, slop: number = MOBILE_TUNING.onDrag.clickSlopPx) {
    if (!this.pointerStart) return false;
    const dx = e.clientX - this.pointerStart.x;
    const dy = e.clientY - this.pointerStart.y;
    return dx * dx + dy * dy > slop * slop;
  }

  private cancelHold() {
    if (this.hold) {
      clearTimeout(this.hold.timer);
      this.hold = null;
    }
  }

  /** 按住后连翻：越翻越快 */
  private fireHold = () => {
    const hold = this.hold;
    if (!hold) return;
    if (!hold.fired) {
      hold.fired = true;
      this.drag = null;
    }
    const sheet = this.sheets[hold.forward ? this.current : this.current - 1];
    if (!sheet) return this.cancelHold();
    if (!this.isAnimating(sheet)) sheet.wobble = this.randomWobble();
    this.setGrab(sheet, this.planePoint(hold.x, hold.y), true);
    const timing = holdTiming(hold.count);
    this.startFlip(sheet, hold.forward, hold.forward ? 1 : 0, timing.flipTime);
    hold.count++;
    hold.timer = setTimeout(this.fireHold, 1000 * timing.gap);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !this.isReady) return;
    this.cancelChain();
    // 触摸永远归翻页（滑动 / 点击 / 按住），阅读器只接管鼠标与触控笔
    if (e.pointerType !== 'touch' && this.pointerInterceptor?.(e)) return;
    const rect = this.canvas.getBoundingClientRect();
    this.spine.copy(this.book.position).project(this.camera);
    const spineX = rect.left + (0.5 * this.spine.x + 0.5) * rect.width;
    const forward = e.clientX >= spineX;
    const sheet = this.sheets[forward ? this.current : this.current - 1];
    if (!sheet) return;

    if (!this.isAnimating(sheet)) sheet.wobble = this.randomWobble();
    this.setGrab(sheet, this.planePoint(e.clientX, e.clientY), true);
    this.animations = this.animations.filter((a) => a.sheet !== sheet);

    this.pointerStart = { x: e.clientX, y: e.clientY };
    this.drag = {
      sheet,
      forward,
      base: sheet.flipProgress,
      progress: sheet.flipProgress,
      rectWidth: rect.width,
      speed: 0,
    };
    this.cancelHold();
    this.hold = {
      forward,
      x: e.clientX,
      y: e.clientY,
      count: 0,
      fired: false,
      timer: setTimeout(this.fireHold, 1000 * MOBILE_TUNING.onHold.startTime),
    };
    this.canvas.setPointerCapture(e.pointerId);
    this.needsRender = true;
    this.updateLoop();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.hold && this.moved(e, this.hold.fired ? MOBILE_TUNING.onHold.moveSlopPx : undefined)) {
      this.cancelHold();
    }
    if (this.drag && this.pointerStart) {
      const d = this.drag;
      d.progress = dragProgress(d.base, e.clientX - this.pointerStart.x, d.rectWidth);
      this.setGrab(d.sheet, this.planePoint(e.clientX, e.clientY), false);
      this.needsRender = true;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.cancelHold();
    const drag = this.drag;
    if (!drag) {
      this.pointerStart = null;
      return;
    }
    const moved = this.moved(e);
    this.drag = null;
    this.pointerStart = null;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* 指针已释放 */
    }

    // 没怎么动：当作点击，按方向翻一页
    if (!moved && e.type !== 'pointercancel') {
      this.startFlip(drag.sheet, drag.forward, drag.forward ? 1 : 0, MOBILE_TUNING.onClick.flipTime);
      return;
    }

    const target: 0 | 1 =
      e.type === 'pointercancel' ? (drag.forward ? 0 : 1) : commitTarget(drag.forward, drag.progress, drag.base);
    this.turn(drag.forward, target);

    const d = MOBILE_TUNING.onDrag;
    const from = drag.sheet.flipProgress;
    const distance = Math.max(Math.abs(target - from), 0.001);
    const fall = d.fallTime * drag.sheet.wobble.flipTime * Math.pow(distance, d.fallTimeExponent);
    const velocity = target === 1 ? drag.speed : -drag.speed;
    const launch = clamp((velocity * fall) / distance, 0, 2);
    this.animations = this.animations.filter((a) => a.sheet !== drag.sheet);
    this.animations.push({
      sheet: drag.sheet,
      from,
      to: target,
      startTime: performance.now(),
      duration: 1000 * fall,
      launch,
    });
    this.needsRender = true;
  };

  private bindEvents() {
    const { signal } = this.abort;
    this.canvas.addEventListener('pointerdown', this.onPointerDown, { signal });
    this.canvas.addEventListener('pointermove', this.onPointerMove, { signal });
    this.canvas.addEventListener('pointerup', this.onPointerUp, { signal });
    this.canvas.addEventListener('pointercancel', this.onPointerUp, { signal });

    // 触摸：横向滑动归翻页（阻止浏览器接管），纵向留给页面滚动
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        this.touch = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, claimed: false } : null;
      },
      { passive: true, signal }
    );
    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (!this.touch || e.touches.length !== 1) return;
        if (this.touch.claimed) {
          if (e.cancelable) e.preventDefault();
          return;
        }
        if (!e.cancelable) {
          this.touch = null;
          return;
        }
        const t = e.touches[0];
        if (claimsHorizontalSwipe(t.clientX - this.touch.x, t.clientY - this.touch.y)) {
          this.touch.claimed = true;
          e.preventDefault();
        }
      },
      { passive: false, signal }
    );
    this.canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        this.cancelHold();
        this.renderer.setAnimationLoop(null);
      },
      { signal }
    );
    this.canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.needsRender = true;
        this.updateLoop();
      },
      { signal }
    );
  }

  // ---------- 渲染循环 ----------

  private updateLoop = () => {
    const run = !this.isDisposed && this.isVisible && !document.hidden && !this.renderer.getContext().isContextLost();
    if (run) {
      this.lastFrameTime = 0;
      this.needsRender = true;
      this.renderer.setAnimationLoop(this.animate);
    } else {
      this.renderer.setAnimationLoop(null);
    }
  };

  private handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.fov = mobileFov();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const maxPixels = 15e6;
    const scaleFactor = Math.sqrt(maxPixels / (width * height));
    this.renderer.setPixelRatio(Math.min(1.2 * (window.devicePixelRatio || 1), 4, scaleFactor));
    this.renderer.setSize(width, height, false);
    this.needsRender = true;
  }

  private animate = (now: number) => {
    const t = performance.now();

    for (let i = this.animations.length - 1; i >= 0; i--) {
      const a = this.animations[i];
      const r = clamp((t - a.startTime) / a.duration, 0, 1);
      a.sheet.flipProgress = a.from + (a.to - a.from) * flipEase(r, a.launch);
      if (t >= a.startTime + a.duration) {
        this.animations.splice(i, 1);
        this.needsRender = true;
      }
    }

    // 翻完最后一张：回到首页，杂志循环
    if (this.count && this.current >= this.count && !this.animations.length && !this.drag) {
      this.current = 0;
      for (const s of this.sheets) s.flipProgress = 0;
      this.syncTextures();
      this.needsRender = true;
      this.notifyPageChange();
    }

    const dt = this.lastFrameTime ? Math.min((now - this.lastFrameTime) / 1000, 0.1) : 1 / 60;
    this.lastFrameTime = now;

    if (this.drag) {
      const d = this.drag;
      const k = 1 - Math.pow(0.01, dt / MOBILE_TUNING.onDrag.progressSmoothTime);
      const delta = (d.progress - d.sheet.flipProgress) * k;
      d.sheet.flipProgress += delta;
      d.speed = dt > 0 ? delta / dt : 0;
    }

    let busy = this.animations.length > 0 || this.drag !== null;
    const grabK = 1 - Math.pow(0.001, dt / MOBILE_TUNING.onGrab.smoothTime);
    for (const s of this.sheets) {
      for (const axis of ['grabX', 'grabY'] as const) {
        const diff = s[`${axis}Target`] - s[axis];
        if (Math.abs(diff) < 1e-4) s[axis] = s[`${axis}Target`];
        else {
          s[axis] += diff * grabK;
          busy = true;
        }
      }
      if (!this.isAnimating(s) && this.drag?.sheet !== s) {
        const rest = s.index < this.current ? 1 : 0;
        if (s.flipProgress !== rest) {
          s.flipProgress = rest;
          this.needsRender = true;
        }
      }
    }

    if (!busy && !this.needsRender) return;

    this.applyShapes();
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.needsRender = false;
  };

  private applyShapes() {
    let sum = 0;
    for (const s of this.sheets) sum += s.flipProgress;

    for (const s of this.sheets) {
      const shape = computeSheetShape({
        index: s.index,
        flipProgress: s.flipProgress,
        sumProgress: sum,
        count: this.count,
        grabX: s.grabX,
        grabY: s.grabY,
        wobbleTiltDeg: s.wobble.tiltDeg,
        catchUp: this.catchUpMap,
        radii: this.radii,
      });
      const u = s.uniforms;
      u.uPileLift.value.set(...shape.pileLift);
      u.uConeTaper.value = shape.coneTaper;
      u.uPileReach.value.set(...shape.pileReach);
      u.uCone.value.set(...shape.cone);
      u.uTailCurl.value.set(...shape.tailCurl);
      u.uTailBend.value = shape.tailBend;
      u.uFlipRotation.value.set(...shape.flipRotation);

      const busy = this.isAnimating(s) || this.drag?.sheet === s;
      s.mesh.visible = sheetVisible(s.index, this.current, sum, busy, this.count);
      s.mesh.renderOrder = sheetRenderOrder(s.index, this.current);
    }

    const offset = bookOffset(sum, this.count, this.catchUpMap);
    this.book.position.x = offset.x;
    this.book.position.z = offset.z;
  }

  // ---------- 销毁 ----------

  public dispose() {
    this.isDisposed = true;
    this.cancelChain();
    this.cancelHold();
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.intersection.disconnect();
    this.renderer.setAnimationLoop(null);

    const first = this.sheets[0];
    first?.mesh.geometry.dispose();
    for (const s of this.sheets) {
      (s.mesh.material as THREE.Material).dispose();
      (s.mesh.customDepthMaterial as THREE.Material | undefined)?.dispose();
    }
    this.pageTextures.forEach((t) => t?.dispose());
    this.patternTexture?.dispose();
    this.placeholderTex.dispose();
    this.blackTex.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
