import * as THREE from 'three';
import { createBakedSheetGeometry, SHEET_ASPECT } from './noiseBaker';
import {
  SHEET_CONSTANTS,
  VERTEX_DECLARATIONS,
  NORMAL_RECOMPUTE,
  DEPTH_VERTEX_POSITION,
  FRAGMENT_HEADER,
  MAP_FRAGMENT,
  ROUGHNESS_FRAGMENT,
  OPAQUE_FRAGMENT,
  NORMAL_FRAGMENT,
} from './shaders';
import type {
  CurveParams,
  SheetData,
  ActiveAnimation,
  DragState,
  AutoFlipState,
} from './types';
import { PageContent } from './chinesePublicationData';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './pageLayout';
import { renderPageBase, paintEditOverlay, RenderOptions, PageEditState } from './pageRenderer';

export interface MagazineEngineOptions {
  container: HTMLElement;
  pageContents: PageContent[];
  patternUrl?: string;
  renderOptions?: RenderOptions;
  onPageChange?: (currentSheet: number, leftPage: number | null, rightPage: number | null) => void;
  onProgress?: (loaded: number, total: number) => void;
  onReady?: () => void;
}

export class MagazineEngine {
  private container: HTMLElement;
  private pageContents: PageContent[];
  private patternUrl?: string;
  private renderOptions: RenderOptions;
  private onPageChange?: (currentSheet: number, leftPage: number | null, rightPage: number | null) => void;
  private onProgress?: (loaded: number, total: number) => void;
  private onReady?: () => void;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private hitArea: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private abortController = new AbortController();

  // Sheets data
  private totalSheets: number;
  private currentSheetIndex = 0; // A: 0..totalSheets
  private sheets: SheetData[] = [];
  private animations: ActiveAnimation[] = [];
  private pageTextures: THREE.CanvasTexture[] = [];
  private patternTexture: THREE.Texture | null = null;
  private placeholderTex: THREE.DataTexture;

  // Native 3D Editor state
  private isEditMode = false;
  private pageEditStates: Record<number, PageEditState | null> = {};
  /** 每页不含覆盖层的底图缓存，hover/光标闪烁只需合成覆盖层 */
  private pageBases: (HTMLCanvasElement | undefined)[] = [];
  /** 每页复用的纹理画布，避免每次交互重新分配 11MB 位图 */
  private pageCanvases: (HTMLCanvasElement | undefined)[] = [];

  // Interaction & Physics state
  private lastActiveSheet = -1;
  private hoverSheet = -1;
  private pointerX = 0;
  private pointerY = 0;
  private isPointerInside = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private dragState: DragState | null = null;
  private autoFlipState: AutoFlipState | null = null;
  private lastHitAreaInset = '';
  private needsRender = true;
  private lastFrameTime = 0;
  private isDisposed = false;
  private isEngineReady = false;

  // Constants identical to paper.design
  private readonly S = {
    angleMaxDeg: 45,
    curlArc: 0.88,
    curlArcJitter: 0.2,
    curlAngleJitter: 0.3,
    curlTiltJitterDeg: 6,
    cornerRollMax: 2.3,
    directionSmoothTime: 0.4,
    settleEpsilon: 1e-4,
    curveSmoothTime: 0.5,
  };

  private readonly Hover = {
    progress: 0.03,
    smoothTime: 2,
    gapToSheetAbove: 0.1,
  };

  private readonly AutoFlip = {
    startTime: 0.22,
    firstFlipTime: 1.2,
    fastestFlipTime: 0.5,
    speedUpSheets: 20,
    firstGapShare: 0.15,
    fastestGapShare: 0.05,
    moveSlopPx: 40,
  };

  private readonly DragPhysics = {
    turnFraction: 0.8,
    progressSmoothTime: 0.9,
    fallTime: 1,
    fallTimeExponent: 0.5,
    landingSpeed: 0.5,
    commitProgress: 0.2,
    clickSlopPx: 5,
  };

  private readonly FlipSettings = {
    flipTime: 0.85,
    followArcGainMin: 1,
    followArcGainMax: 1.08,
  };

  // Reusable math objects
  private raycaster = new THREE.Raycaster();
  private mouseVec = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private intersectPoint = new THREE.Vector3();

  constructor(options: MagazineEngineOptions) {
    this.container = options.container;
    this.pageContents = options.pageContents;
    this.patternUrl = options.patternUrl;
    this.renderOptions = options.renderOptions || {};
    this.onPageChange = options.onPageChange;
    this.onProgress = options.onProgress;
    this.onReady = options.onReady;

    this.totalSheets = Math.ceil(this.pageContents.length / 2);

    // Setup Three.js scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1.44753, 1.5, 4.5);
    this.camera.position.set(0, 0, 2.99);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    this.canvas = this.renderer.domElement;
    this.canvas.dataset.magazineLayer = '';
    this.canvas.style.display = 'block';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '-27.975%';
    this.canvas.style.left = '-27.975%';
    this.canvas.style.width = '155.95%';
    this.canvas.style.height = '155.95%';
    this.canvas.style.pointerEvents = 'none';
    this.container.appendChild(this.canvas);

    // Hit area overlay
    this.hitArea = document.createElement('div');
    this.hitArea.dataset.magazineHitArea = '';
    this.hitArea.style.cssText =
      'position:absolute;inset:0 0 0 50%;pointer-events:auto;touch-action:pan-y pinch-zoom;cursor:pointer;';
    this.container.appendChild(this.hitArea);

    this.container.style.setProperty('-webkit-touch-callout', 'none');
    this.container.style.setProperty('-webkit-user-select', 'none');
    this.container.style.setProperty('user-select', 'none');

    // Lights
    const lightGroup = new THREE.Group();
    this.scene.add(lightGroup);

    const hemiLight = new THREE.HemisphereLight('#ffffff', '#a1aeaf', 1.5);
    lightGroup.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 2.0);
    dirLight.position.set(-3.5, 1.3, 4.1);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -0.8;
    dirLight.shadow.camera.right = 1.0;
    dirLight.shadow.camera.top = 0.85;
    dirLight.shadow.camera.bottom = -1.05;
    dirLight.shadow.camera.near = 1.5;
    dirLight.shadow.camera.far = 6.6;
    dirLight.shadow.bias = -0.001;
    lightGroup.add(dirLight);
    lightGroup.add(dirLight.target);

    // Ground shadow plane
    const shadowGeo = new THREE.PlaneGeometry(6.25, 6.25);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.z = -1e-5;
    shadowMesh.receiveShadow = true;
    this.scene.add(shadowMesh);

    // Placeholder textures
    this.placeholderTex = new THREE.DataTexture(new Uint8Array([250, 247, 242, 255]), 1, 1);
    this.placeholderTex.colorSpace = THREE.SRGBColorSpace;
    this.placeholderTex.needsUpdate = true;

    // Create sheet meshes
    this.createSheets();

    // Event listeners
    this.bindEvents();

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvas);
    this.handleResize();

    // Generate dynamic canvas textures for all pages
    this.initPatternTexture();
    this.renderAllPageTextures();

    // Re-render once web fonts (such as LXGW WenKai) finish loading in browser
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (!this.isDisposed) {
          this.renderAllPageTextures();
        }
      });
    }

    // Start animation loop
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  private stackLift(sheetIndex: number, isFlipped: number): number {
    return (
      0.31 +
      0.69 *
        (this.totalSheets > 1
          ? (sheetIndex + (this.totalSheets - 1 - 2 * sheetIndex) * (1 - isFlipped)) /
            (this.totalSheets - 1)
          : 1)
    );
  }

  private isSheetAnimating(sheetIndex: number): boolean {
    return this.animations.some((a) => a.sheetIndex === sheetIndex);
  }

  private createSheets() {
    const geometry = createBakedSheetGeometry(64, 88);
    const blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blackTex.needsUpdate = true;

    for (let i = 0; i < this.totalSheets; i++) {
      const uniforms = {
        uDirection: { value: 1.0 },
        uStackLift: { value: 1.0 },
        uFlipProgress: { value: 0.0 },
        uWrinkleSide: { value: -1.0 },
        uBendAngle: { value: 0.0 },
        uFold: { value: new THREE.Vector2(1, 0) },
        uCurl: { value: new THREE.Vector2(0, 1) },
        uFlipRotation: { value: new THREE.Vector2(1, 0) },
        uPatternTex: { value: blackTex },
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
        shader.vertexShader = VERTEX_DECLARATIONS + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>\n{\n${NORMAL_RECOMPUTE}\nobjectNormal = surfaceNormal;\n}\n`
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `vec3 transformed = _transformedSheetPosition;\nvGrainUv = uv;\n`
        );

        shader.fragmentShader =
          FRAGMENT_HEADER + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_begin>',
          NORMAL_FRAGMENT
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          MAP_FRAGMENT
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          ROUGHNESS_FRAGMENT
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          OPAQUE_FRAGMENT
        );
      };

      const depthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        side: THREE.DoubleSide,
      });

      depthMaterial.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = VERTEX_DECLARATIONS + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `${DEPTH_VERTEX_POSITION}\nvec3 transformed = _transformedSheetPosition - vec3(SHADOW_OFFSET_X, 0., 0.);\n`
        );
      };

      const mesh = new THREE.Mesh(geometry, material);
      mesh.customDepthMaterial = depthMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const baseLift = this.stackLift(i, 0);
      const spanLift = this.stackLift(i, 1) - baseLift;

      const sheetData: SheetData = {
        mesh,
        sheetUniforms: uniforms,
        frontTex: this.placeholderTex,
        flipProgress: i < this.currentSheetIndex ? 1 : 0,
        direction: 1,
        directionSmooth: 1,
        curve: { curlArc: 0, curlAngleDeg: 0 },
        curveTarget: { curlArc: 0, curlAngleDeg: 0 },
        wobble: { arc: 0.5, angle: 0.5, tilt: 0 },
        stackLiftBase: baseLift,
        stackLiftSpan: spanLift,
      };

      this.sheets.push(sheetData);
      this.scene.add(mesh);
    }
  }

  private initPatternTexture() {
    if (this.patternUrl) {
      new THREE.TextureLoader().load(
        this.patternUrl,
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          this.patternTexture = tex;
          for (const s of this.sheets) {
            s.sheetUniforms.uPatternTex.value = tex;
          }
          this.renderer.initTexture(tex);
          this.needsRender = true;
        },
        undefined,
        () => {
          this.createProceduralPatternTexture();
        }
      );
    } else {
      this.createProceduralPatternTexture();
    }
  }

  private createProceduralPatternTexture() {
    // Generate fine paper fiber roughness procedural texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 384;
    pCanvas.height = 384;
    const pCtx = pCanvas.getContext('2d')!;
    const imgData = pCtx.createImageData(384, 384);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = 110 + Math.floor(Math.random() * 50);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    pCtx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(pCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.patternTexture = tex;
    for (const s of this.sheets) {
      s.sheetUniforms.uPatternTex.value = tex;
    }
    this.renderer.initTexture(tex);
    this.needsRender = true;
  }

  /** 将页面画布提交为 CanvasTexture，并绑定到对应印张的正/背面材质 */
  private applyPageCanvas(pageIndex: number, canvas: HTMLCanvasElement) {
    let tex = this.pageTextures[pageIndex];
    if (!tex) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.pageTextures[pageIndex] = tex;
      this.renderer.initTexture(tex);
    } else {
      tex.image = canvas;
      tex.needsUpdate = true;
    }

    const sheet = this.sheets[pageIndex >> 1];
    if (!sheet) return;
    if (pageIndex % 2 === 0) {
      sheet.frontTex = tex;
      const material = sheet.mesh.material as THREE.MeshStandardMaterial;
      if (material.map !== tex) {
        material.map = tex;
        material.needsUpdate = true;
      }
    } else {
      sheet.sheetUniforms.uBackMap.value = tex;
    }
  }

  /** 底图 + 当前编辑覆盖层 → 纹理；rebuildBase 为 true 时重新排版绘制底图 */
  private composePage(pageIndex: number, rebuildBase: boolean) {
    const page = this.pageContents[pageIndex];
    if (!page) return;
    let base = this.pageBases[pageIndex];
    if (!base || rebuildBase) {
      base = renderPageBase(page, this.renderOptions);
      this.pageBases[pageIndex] = base;
    }

    let canvas = this.pageCanvases[pageIndex];
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = base.width;
      canvas.height = base.height;
      this.pageCanvases[pageIndex] = canvas;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(base, 0, 0);

    const editState = this.pageEditStates[pageIndex];
    if (editState) {
      paintEditOverlay(ctx, page, this.renderOptions, editState);
    }
    this.applyPageCanvas(pageIndex, canvas);
    this.needsRender = true;
  }

  public renderAllPageTextures(customOptions?: RenderOptions) {
    if (customOptions) {
      this.renderOptions = { ...this.renderOptions, ...customOptions };
    }

    this.pageContents.forEach((_, i) => {
      this.composePage(i, true);
      this.onProgress?.(i + 1, this.pageContents.length);
    });

    this.needsRender = true;
    if (!this.isEngineReady) {
      this.isEngineReady = true;
      this.onReady?.();
    }
  }

  public updatePageContent(pageIndex: number, newContent: PageContent) {
    if (pageIndex < 0 || pageIndex >= this.pageContents.length) return;
    this.pageContents[pageIndex] = newContent;
    this.composePage(pageIndex, true);
  }

  public setAllPageContents(newContents: PageContent[]) {
    this.pageContents = [...newContents];
    this.renderAllPageTextures();
  }

  public setEditMode(enabled: boolean) {
    this.isEditMode = enabled;
    if (enabled) {
      this.cancelAutoFlip();
      this.dragState = null;
      this.hoverSheet = -1;
      if (this.hitArea) {
        this.hitArea.style.cursor = 'default';
      }
    } else {
      if (this.hitArea) {
        this.hitArea.style.cursor = 'pointer';
      }
    }
    this.needsRender = true;
  }

  public clearAllEditStates() {
    for (const key of Object.keys(this.pageEditStates)) {
      if (this.pageEditStates[Number(key)]) this.updatePageEditState(Number(key), null);
    }
    this.pageEditStates = {};
  }

  public getLeftPageIndex(): number | null {
    if (this.currentSheetIndex === 0) return null;
    return (this.currentSheetIndex * 2) - 1;
  }

  public getRightPageIndex(): number | null {
    if (this.currentSheetIndex >= this.totalSheets) return null;
    if (this.currentSheetIndex === 0) return 0;
    const rightPage1Based = this.currentSheetIndex * 2 + 1;
    if (rightPage1Based > this.pageContents.length) return null;
    return rightPage1Based - 1;
  }

  /**
   * 将浏览器视口鼠标指针客户端坐标 (clientX, clientY)
   * 经 Three.js 摄像机与 3D 书页表面射线拾取，解算为出版物纹理像素坐标 (canvasX, canvasY)
   */
  public getCanvasCoordsFromClient(clientX: number, clientY: number): {
    pageIndex: number;
    side: 'left' | 'right';
    canvasX: number;
    canvasY: number;
  } | null {
    if (this.isFlipping()) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    this.mouseVec.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(2 * ((clientY - rect.top) / rect.height)) + 1
    );
    this.raycaster.setFromCamera(this.mouseVec, this.camera);

    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.intersectPoint)) {
      return null;
    }

    const px = this.intersectPoint.x;
    const py = this.intersectPoint.y;

    // 书页在 3D 世界半高度
    const halfH = SHEET_ASPECT / 2;
    if (py < -halfH || py > halfH) {
      return null;
    }

    const canvasY = ((halfH - py) / SHEET_ASPECT) * CANVAS_HEIGHT;

    if (px >= 0 && px <= 1.0) {
      const pageIndex = this.getRightPageIndex();
      if (pageIndex === null) return null;
      const canvasX = px * CANVAS_WIDTH;
      return {
        pageIndex,
        side: 'right',
        canvasX,
        canvasY,
      };
    } else if (px >= -1.0 && px < 0) {
      const pageIndex = this.getLeftPageIndex();
      if (pageIndex === null) return null;
      const canvasX = (1.0 + px) * CANVAS_WIDTH;
      return {
        pageIndex,
        side: 'left',
        canvasX,
        canvasY,
      };
    }

    return null;
  }

  /**
   * 原生 3D 编辑态材质热重绘：
   * 将当前页面的高亮选框、裁切角标、闪烁光标等直接绘制入 2D 纹理 Canvas，
   * 毫秒级提交至 WebGL 材质，实现 0 重影、0 视差的原生 3D 书页编辑。
   */
  public updatePageEditState(
    pageIndex: number,
    editState: PageEditState | null,
    options: { render?: boolean } = {}
  ) {
    if (pageIndex < 0 || pageIndex >= this.pageContents.length) return;
    this.pageEditStates[pageIndex] = editState;
    // render:false 时只记录状态，由紧随其后的 updatePageContent 一次性绘制
    if (options.render !== false) this.composePage(pageIndex, false);
  }

  /** 画布纹理坐标 → 浏览器视口坐标（用于把 IME 候选窗定位到光标处） */
  public getClientCoordsFromCanvas(
    pageIndex: number,
    canvasX: number,
    canvasY: number
  ): { x: number; y: number } | null {
    let px: number;
    if (pageIndex === this.getRightPageIndex()) px = canvasX / CANVAS_WIDTH;
    else if (pageIndex === this.getLeftPageIndex()) px = canvasX / CANVAS_WIDTH - 1;
    else return null;
    const py = SHEET_ASPECT / 2 - (canvasY / CANVAS_HEIGHT) * SHEET_ASPECT;
    const v = new THREE.Vector3(px, py, 0).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
    };
  }

  /** 翻页动画或拖拽进行中，纹理坐标与屏幕不再对应 */
  public isFlipping(): boolean {
    return this.animations.length > 0 || this.dragState !== null;
  }

  private cornerRollMax(deg: number): number {
    const rad = (Math.abs(deg) * Math.PI) / 180;
    const a = 1 - 0.6885 * Math.sin(rad);
    const n = Math.cos(rad) / a;
    return this.S.cornerRollMax / (Math.PI * n);
  }

  private computeTargetCurve(clientX: number, clientY: number, sheetIndex: number): CurveParams {
    const sheet = this.sheets[sheetIndex];
    if (!sheet) return { curlArc: this.S.curlArc, curlAngleDeg: 0 };
    const wobble = sheet.wobble;
    const rect = this.canvas.getBoundingClientRect();

    this.mouseVec.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(2 * ((clientY - rect.top) / rect.height)) + 1
    );
    this.raycaster.setFromCamera(this.mouseVec, this.camera);

    let hit: { angle: number; distanceFromSpine: number } | null = null;
    if (this.raycaster.ray.intersectPlane(this.groundPlane, this.intersectPoint)) {
      hit = {
        angle: Math.atan2(this.intersectPoint.y, this.intersectPoint.x),
        distanceFromSpine: Math.hypot(this.intersectPoint.x, this.intersectPoint.y),
      };
    }

    const prevActiveTarget = (() => {
      const prevSheet = this.sheets[this.lastActiveSheet];
      if (prevSheet && this.lastActiveSheet !== sheetIndex && this.isSheetAnimating(this.lastActiveSheet)) {
        const cond = prevSheet.direction > 0 ? prevSheet.flipProgress > 0.5 : prevSheet.flipProgress < 0.5;
        return cond ? undefined : prevSheet.curveTarget;
      }
      return undefined;
    })();

    let angleDeg = 0;
    if (hit) {
      let deg = (180 * hit.angle) / Math.PI;
      if (deg > 90) deg = 180 - deg;
      if (deg < -90) deg = -180 - deg;
      const t = 1 - wobble.angle * this.S.curlAngleJitter;
      angleDeg = THREE.MathUtils.clamp(
        -(deg / 90) * this.S.angleMaxDeg * hit.distanceFromSpine * t +
          wobble.tilt * this.S.curlTiltJitterDeg,
        -this.S.angleMaxDeg,
        this.S.angleMaxDeg
      );
    }

    const rollMax = this.cornerRollMax(angleDeg);
    if (!prevActiveTarget) {
      const arcScale = 1 - wobble.arc * this.S.curlArcJitter;
      return {
        curlArc: Math.min(this.S.curlArc * arcScale, rollMax),
        curlAngleDeg: angleDeg,
      };
    }

    angleDeg = THREE.MathUtils.clamp(
      angleDeg,
      Math.min(0, prevActiveTarget.curlAngleDeg),
      Math.max(0, prevActiveTarget.curlAngleDeg)
    );

    const followGain = THREE.MathUtils.lerp(
      this.FlipSettings.followArcGainMin,
      this.FlipSettings.followArcGainMax,
      wobble.arc
    );

    return {
      curlArc: THREE.MathUtils.clamp(
        prevActiveTarget.curlArc * followGain,
        prevActiveTarget.curlArc,
        this.cornerRollMax(angleDeg)
      ),
      curlAngleDeg: angleDeg,
    };
  }

  private getSheetTargetUnderPointer(clientX: number): { sheetIndex: number; forward: boolean } | null {
    if (this.isEditMode) return null;
    const rect = this.canvas.getBoundingClientRect();
    const forward = clientX - rect.left >= rect.width / 2;
    if (forward ? this.currentSheetIndex >= this.totalSheets : this.currentSheetIndex <= 0) {
      return null;
    }
    return {
      sheetIndex: forward ? this.currentSheetIndex : this.currentSheetIndex - 1,
      forward,
    };
  }

  private setSheetCurve(sheet: SheetData, curve: CurveParams, immediate = false) {
    sheet.curveTarget.curlArc = curve.curlArc;
    sheet.curveTarget.curlAngleDeg = curve.curlAngleDeg;
    if (immediate) {
      sheet.curve.curlArc = curve.curlArc;
      sheet.curve.curlAngleDeg = curve.curlAngleDeg;
    }
  }

  private triggerSheetFlip(
    sheetIndex: number,
    forward: boolean,
    targetProgress: number,
    durationSec = this.FlipSettings.flipTime
  ) {
    this.lastActiveSheet = sheetIndex;
    const sheet = this.sheets[sheetIndex];
    sheet.wobble = {
      arc: Math.random(),
      angle: Math.random(),
      tilt: 2 * Math.random() - 1,
    };

    this.currentSheetIndex = targetProgress === 1 ? sheetIndex + 1 : sheetIndex;
    this.notifyPageChange();
    this.needsRender = true;

    const fromProg = sheet.flipProgress;
    const durationMs =
      1000 * durationSec * Math.max(0.2, Math.abs(targetProgress - fromProg));

    const existingIdx = this.animations.findIndex((a) => a.sheetIndex === sheetIndex);
    if (existingIdx !== -1) this.animations.splice(existingIdx, 1);

    this.animations.push({
      sheetIndex,
      fromProgress: fromProg,
      toProgress: targetProgress,
      direction: forward ? 1 : -1,
      startTime: performance.now(),
      duration: durationMs,
    });
  }

  private cancelAutoFlip() {
    if (this.autoFlipState) {
      clearTimeout(this.autoFlipState.timer);
      this.autoFlipState = null;
    }
  }

  private performAutoFlipStep() {
    if (!this.autoFlipState) return;
    if (!this.autoFlipState.fired) {
      this.autoFlipState.fired = true;
      this.dragState = null;
    }

    const { forward, count, x, y } = this.autoFlipState;
    if (forward ? this.currentSheetIndex >= this.totalSheets : this.currentSheetIndex <= 0) {
      this.cancelAutoFlip();
      return;
    }

    const speedT = Math.min(count / this.AutoFlip.speedUpSheets, 1);
    const flipTime =
      this.AutoFlip.firstFlipTime +
      (this.AutoFlip.fastestFlipTime - this.AutoFlip.firstFlipTime) * speedT;
    const gapShare =
      this.AutoFlip.firstGapShare +
      (this.AutoFlip.fastestGapShare - this.AutoFlip.firstGapShare) * speedT;

    const targetSheet = forward ? this.currentSheetIndex : this.currentSheetIndex - 1;
    const sheet = this.sheets[targetSheet];

    const targetCurve = count === 0 ? sheet.curveTarget : this.computeTargetCurve(x, y, targetSheet);
    this.setSheetCurve(sheet, targetCurve, true);
    sheet.direction = forward ? 1 : -1;

    this.triggerSheetFlip(targetSheet, forward, forward ? 1 : 0, flipTime);

    this.autoFlipState.count++;
    this.autoFlipState.timer = setTimeout(
      this.performAutoFlipStep.bind(this),
      1000 * flipTime * gapShare
    );
  }

  private handlePointerDown(e: PointerEvent) {
    if (this.isEditMode) return;
    if (e.button !== 0) return;
    const target = this.getSheetTargetUnderPointer(e.clientX);
    if (!target) return;

    const sheet = this.sheets[target.sheetIndex];
    if (!this.isSheetAnimating(target.sheetIndex)) {
      this.setSheetCurve(sheet, this.computeTargetCurve(e.clientX, e.clientY, target.sheetIndex), true);
    }

    const animIdx = this.animations.findIndex((a) => a.sheetIndex === target.sheetIndex);
    if (animIdx !== -1) this.animations.splice(animIdx, 1);

    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.dragState = {
      sheetIndex: target.sheetIndex,
      forward: target.forward,
      base: sheet.flipProgress,
      progress: sheet.flipProgress,
      rectWidth: this.canvas.getBoundingClientRect().width,
      targetCurve: { ...sheet.curveTarget },
      speed: 0,
    };

    sheet.direction = target.forward ? 1 : -1;

    this.cancelAutoFlip();
    this.autoFlipState = {
      forward: target.forward,
      x: e.clientX,
      y: e.clientY,
      count: 0,
      fired: false,
      timer: setTimeout(this.performAutoFlipStep.bind(this), 1000 * this.AutoFlip.startTime),
    };

    try {
      this.hitArea.setPointerCapture(e.pointerId);
    } catch {}

    this.needsRender = true;
  }

  private handlePointerMove(e: PointerEvent) {
    if (this.isEditMode) {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      return;
    }

    if (this.autoFlipState) {
      if (this.pointerDownPos) {
        const distSq =
          (e.clientX - this.pointerDownPos.x) ** 2 + (e.clientY - this.pointerDownPos.y) ** 2;
        const slop = this.autoFlipState.fired ? this.AutoFlip.moveSlopPx : this.DragPhysics.clickSlopPx;
        if (distSq > slop * slop) {
          this.cancelAutoFlip();
        }
      }
    }

    if (this.dragState) {
      const deltaX = e.clientX - (this.pointerDownPos ? this.pointerDownPos.x : e.clientX);
      this.dragState.progress = THREE.MathUtils.clamp(
        this.dragState.base - deltaX / this.dragState.rectWidth / this.DragPhysics.turnFraction,
        0,
        1
      );
      this.dragState.targetCurve = this.computeTargetCurve(
        e.clientX,
        e.clientY,
        this.dragState.sheetIndex
      );
      this.needsRender = true;
      return;
    }

    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
    this.isPointerInside = true;
    this.needsRender = true;
  }

  private handlePointerUp(e: PointerEvent) {
    if (this.isEditMode) return;
    this.cancelAutoFlip();
    if (!this.dragState) {
      this.pointerDownPos = null;
      return;
    }

    const drag = this.dragState;
    const isDragMoved = this.pointerDownPos
      ? (e.clientX - this.pointerDownPos.x) ** 2 + (e.clientY - this.pointerDownPos.y) ** 2 >
        this.DragPhysics.clickSlopPx ** 2
      : false;

    this.dragState = null;
    this.pointerDownPos = null;

    try {
      this.hitArea.releasePointerCapture(e.pointerId);
    } catch {}

    if (!isDragMoved) {
      this.triggerSheetFlip(drag.sheetIndex, drag.forward, drag.forward ? 1 : 0);
      return;
    }

    const commit =
      (drag.forward ? drag.progress - drag.base : drag.base - drag.progress) >=
      this.DragPhysics.commitProgress;
    const targetProgress = drag.forward === commit ? 1 : 0;

    this.lastActiveSheet = drag.sheetIndex;
    const sheet = this.sheets[drag.sheetIndex];
    sheet.wobble = {
      arc: Math.random(),
      angle: Math.random(),
      tilt: 2 * Math.random() - 1,
    };
    this.currentSheetIndex = targetProgress === 1 ? drag.sheetIndex + 1 : drag.sheetIndex;
    this.notifyPageChange();

    const fromProg = sheet.flipProgress;
    const speed = targetProgress === 1 ? drag.speed : -drag.speed;
    const delta = Math.max(Math.abs(targetProgress - fromProg), 0.001);
    const fallDuration = this.DragPhysics.fallTime * Math.pow(delta, this.DragPhysics.fallTimeExponent);

    const existingIdx = this.animations.findIndex((a) => a.sheetIndex === drag.sheetIndex);
    if (existingIdx !== -1) this.animations.splice(existingIdx, 1);

    this.animations.push({
      sheetIndex: drag.sheetIndex,
      fromProgress: fromProg,
      toProgress: targetProgress,
      direction: drag.forward ? 1 : -1,
      startTime: performance.now(),
      duration: 1000 * fallDuration,
      launch: THREE.MathUtils.clamp((speed * fallDuration) / delta, 0, 2),
    });

    this.needsRender = true;
  }

  private bindEvents() {
    const signal = this.abortController.signal;

    this.hitArea.addEventListener('pointerdown', (e) => this.handlePointerDown(e), { signal });
    this.hitArea.addEventListener('pointermove', (e) => this.handlePointerMove(e), { signal });
    this.hitArea.addEventListener('pointerup', (e) => this.handlePointerUp(e), { signal });
    this.hitArea.addEventListener('pointercancel', (e) => this.handlePointerUp(e), { signal });
    this.hitArea.addEventListener('pointerleave', () => {
      this.isPointerInside = false;
      this.needsRender = true;
    }, { signal });
  }

  private handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const maxPixels = 15e6;
    const scaleFactor = Math.sqrt(maxPixels / (width * height));
    const pr = Math.min(window.devicePixelRatio || 1, 4, scaleFactor);

    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height, false);
    this.needsRender = true;
  }

  private notifyPageChange() {
    let left: number | null = null;
    let right: number | null = null;

    if (this.currentSheetIndex === 0) {
      left = null;
      right = 1;
    } else if (this.currentSheetIndex === this.totalSheets) {
      left = this.totalSheets * 2;
      right = null;
    } else {
      left = this.currentSheetIndex * 2;
      right = this.currentSheetIndex * 2 + 1;
    }

    this.onPageChange?.(this.currentSheetIndex, left, right);
  }

  private animate(currentTime: number) {
    if (this.isDisposed) return;

    const now = performance.now();

    // 1. Process active flip animations
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i];
      const sheet = this.sheets[anim.sheetIndex];
      const p = Math.min(Math.max((now - anim.startTime) / anim.duration, 0), 1);

      let ease: number;
      if (anim.launch === undefined) {
        ease = 0.5 * (1 - Math.cos(p * Math.PI));
      } else {
        const a = anim.launch;
        const n = this.DragPhysics.landingSpeed;
        const o = p * p;
        const r = o * p;
        ease = (r - 2 * o + p) * a + (3 * o - 2 * r) + (r - o) * n;
      }

      sheet.flipProgress = anim.fromProgress + (anim.toProgress - anim.fromProgress) * ease;
      sheet.direction = anim.direction;

      if (now >= anim.startTime + anim.duration) {
        this.animations.splice(i, 1);
        this.needsRender = true;
      }
    }

    // Delta time
    const dt = this.lastFrameTime ? Math.min((currentTime - this.lastFrameTime) / 1000, 0.1) : 1 / 60;
    this.lastFrameTime = currentTime;

    // 2. Drag physics update
    if (this.dragState) {
      const sheet = this.sheets[this.dragState.sheetIndex];
      const smoothAlpha = 1 - Math.pow(0.01, dt / this.DragPhysics.progressSmoothTime);
      const delta = (this.dragState.progress - sheet.flipProgress) * smoothAlpha;
      sheet.flipProgress += delta;
      this.dragState.speed = dt > 0 ? delta / dt : 0;
      this.setSheetCurve(sheet, this.dragState.targetCurve, false);
    }

    let isBusy = this.animations.length > 0 || this.dragState !== null;
    const smoothProgress = 1 - Math.pow(0.001, dt / this.Hover.smoothTime);
    const smoothCurve = 1 - Math.pow(0.001, dt / this.S.curveSmoothTime);
    const smoothDir = 1 - Math.pow(0.001, dt / this.S.directionSmoothTime);

    // Hover peek target
    const hoverTarget = this.isEditMode || !this.isPointerInside || this.dragState || this.autoFlipState
      ? null
      : this.getSheetTargetUnderPointer(this.pointerX);

    const prevHover = this.hoverSheet;
    this.hoverSheet = hoverTarget && !this.isSheetAnimating(hoverTarget.sheetIndex) ? hoverTarget.sheetIndex : -1;
    if (this.hoverSheet !== -1) {
      this.setSheetCurve(
        this.sheets[this.hoverSheet],
        this.computeTargetCurve(this.pointerX, this.pointerY, this.hoverSheet),
        this.hoverSheet !== prevHover
      );
    }

    // 3. Update each sheet physics and uniforms
    for (let i = 0; i < this.sheets.length; i++) {
      const sheet = this.sheets[i];

      if (!this.isSheetAnimating(i) && !(this.dragState && this.dragState.sheetIndex === i)) {
        const isHovered = i === this.hoverSheet;
        const targetRest = i >= this.currentSheetIndex ? 0 : 1;
        const dest = isHovered
          ? targetRest === 0
            ? this.Hover.progress
            : 1 - this.Hover.progress
          : targetRest;

        const diff = dest - sheet.flipProgress;
        if (Math.abs(diff) < this.S.settleEpsilon) {
          if (sheet.flipProgress !== dest) {
            sheet.flipProgress = dest;
            this.needsRender = true;
          }
        } else {
          sheet.flipProgress += diff * smoothProgress;
          isBusy = true;
        }

        const neighbor = this.sheets[targetRest === 0 ? i - 1 : i + 1];
        if (neighbor) {
          const clamped =
            targetRest === 0
              ? Math.min(sheet.flipProgress, Math.max(0, neighbor.flipProgress - this.Hover.gapToSheetAbove))
              : Math.max(sheet.flipProgress, Math.min(1, neighbor.flipProgress + this.Hover.gapToSheetAbove));
          if (clamped !== sheet.flipProgress) {
            sheet.flipProgress = clamped;
            isBusy = true;
          }
        }

        sheet.direction = targetRest === 1 && sheet.flipProgress !== targetRest ? -1 : 1;
        sheet.directionSmooth = sheet.direction;
      }

      const dirDiff = sheet.direction - sheet.directionSmooth;
      if (Math.abs(dirDiff) < this.S.settleEpsilon) {
        if (sheet.directionSmooth !== sheet.direction) {
          sheet.directionSmooth = sheet.direction;
          this.needsRender = true;
        }
      } else {
        sheet.directionSmooth += dirDiff * smoothDir;
        isBusy = true;
      }

      for (const key of ['curlArc', 'curlAngleDeg'] as const) {
        const cDiff = sheet.curveTarget[key] - sheet.curve[key];
        if (Math.abs(cDiff) < this.S.settleEpsilon) {
          sheet.curve[key] = sheet.curveTarget[key];
        } else {
          sheet.curve[key] += cDiff * smoothCurve;
          isBusy = true;
        }
      }

      const lift = sheet.stackLiftBase + sheet.stackLiftSpan * sheet.flipProgress;
      const uniforms = sheet.sheetUniforms;
      const curve = sheet.curve;
      const dirSmooth = sheet.directionSmooth;
      const progressPI = sheet.flipProgress * Math.PI;
      const bend = Math.sin(progressPI) * Math.PI * curve.curlArc;
      const rad = (curve.curlAngleDeg * Math.PI) / 180;
      const cosRad = Math.cos(rad);
      const sinRad = Math.sin(rad);
      const u = 1 - 0.6885 * Math.sin(Math.abs(rad));
      const d = 1 - u;
      const f = 0.6885 * Math.sign(sinRad);
      const m = Math.max(0, cosRad + sinRad * f - d);
      const p = (m / u) * bend;
      const g =
        progressPI +
        0.5 *
          dirSmooth *
          (m * (Math.abs(p) < 1e-4 ? 0 : (1 - Math.cos(p)) / p));

      uniforms.uFlipProgress.value = sheet.flipProgress;
      uniforms.uWrinkleSide.value = -Math.cos(progressPI);
      uniforms.uDirection.value = dirSmooth;
      uniforms.uStackLift.value = lift;
      uniforms.uBendAngle.value = bend;
      uniforms.uFold.value.set(cosRad, sinRad);
      uniforms.uCurl.value.set(d, u);
      uniforms.uFlipRotation.value.set(Math.cos(g), Math.sin(g));
    }

    // 4. Update hit area inset
    const isInteracting = this.animations.length > 0 || this.dragState !== null || this.autoFlipState !== null;
    const isAtStart = this.currentSheetIndex === 0 && !isInteracting;
    const isAtEnd = this.currentSheetIndex === this.totalSheets && !isInteracting;
    const targetInset = isAtStart ? '0 0 0 50%' : isAtEnd ? '0 50% 0 0' : '0';
    if (targetInset !== this.lastHitAreaInset) {
      this.lastHitAreaInset = targetInset;
      this.hitArea.style.inset = targetInset;
    }

    // 5. Render if busy or needsRender
    if (isBusy || this.needsRender) {
      for (let i = 0; i < this.sheets.length; i++) {
        const sheet = this.sheets[i];
        const distFromCurrent = i >= this.currentSheetIndex ? i - this.currentSheetIndex : this.currentSheetIndex - 1 - i;
        const shouldShadow = distFromCurrent < 3 || this.isSheetAnimating(i) || (this.dragState !== null && this.dragState.sheetIndex === i);
        if (sheet.mesh.castShadow !== shouldShadow) {
          sheet.mesh.castShadow = shouldShadow;
        }
        sheet.mesh.renderOrder = distFromCurrent;
      }

      this.renderer.shadowMap.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }

  public flipNext() {
    if (this.currentSheetIndex < this.totalSheets) {
      this.triggerSheetFlip(this.currentSheetIndex, true, 1);
    }
  }

  public flipPrev() {
    if (this.currentSheetIndex > 0) {
      this.triggerSheetFlip(this.currentSheetIndex - 1, false, 0);
    }
  }

  public goToSheet(targetIndex: number) {
    const clamped = THREE.MathUtils.clamp(targetIndex, 0, this.totalSheets);
    if (clamped === this.currentSheetIndex) return;

    if (clamped > this.currentSheetIndex) {
      let delay = 0;
      for (let i = this.currentSheetIndex; i < clamped; i++) {
        setTimeout(() => {
          if (!this.isDisposed) {
            this.triggerSheetFlip(i, true, 1, 0.6);
          }
        }, delay);
        delay += 90;
      }
    } else {
      let delay = 0;
      for (let i = this.currentSheetIndex - 1; i >= clamped; i--) {
        setTimeout(() => {
          if (!this.isDisposed) {
            this.triggerSheetFlip(i, false, 0, 0.6);
          }
        }, delay);
        delay += 90;
      }
    }
  }

  public getCurrentSheet(): number {
    return this.currentSheetIndex;
  }

  public getTotalSheets(): number {
    return this.totalSheets;
  }

  public dispose() {
    this.isDisposed = true;
    this.cancelAutoFlip();
    this.abortController.abort();
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);

    for (const sheet of this.sheets) {
      sheet.mesh.geometry.dispose();
      (sheet.mesh.material as THREE.Material).dispose();
      sheet.mesh.customDepthMaterial?.dispose();
    }

    for (const tex of this.pageTextures) {
      tex?.dispose();
    }

    this.patternTexture?.dispose();
    this.placeholderTex.dispose();
    this.renderer.dispose();
    this.hitArea.remove();
    this.canvas.remove();
  }
}
