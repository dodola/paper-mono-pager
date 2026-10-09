/**
 * 移动端「单页堆叠」杂志的纯逻辑：画框与相机、手势仲裁、翻页缓动与节奏、
 * 以及每张纸的形变参数（堆叠抬升 → 尾部弯曲 → 锥形卷起 → 绕书脊旋转）。
 * 只含数学，不依赖 three / DOM，便于单元测试；绘制与交互见 MobileMagazineEngine。
 */

/**
 * 默认走单页堆叠的条件：窄屏（< 1024px）或竖屏（高大于宽）。
 * 竖屏归单页与参考实现一致；宽度阈值取 1024 是为了让平板、小窗口尽量保持单页，
 * 双页对开只在足够宽的横屏下出现。可通过 PaperMagazine 的 `singlePageQuery` 覆盖。
 */
export const DEFAULT_SINGLE_PAGE_QUERY = '(max-width: 1023px), (orientation: portrait)';

/** 单张纸的高宽比（宽 1，高 1.377） */
export const MOBILE_SHEET_ASPECT = 1.377;
const HALF_H = MOBILE_SHEET_ASPECT / 2;

/** 画框（世界坐标）：相机正对其中心，fov 随画框高度反算，宽度自适应容器 */
export const MOBILE_FRAME = { left: -0.34, right: 1.22, bottom: -1.2, top: 1.2 } as const;
export const MOBILE_CAMERA_Z = 3.1;

/** 画布层相对容器的 CSS 放大倍数（以中心为原点，允许溢出容器），让书页在窄屏上更大 */
export const MOBILE_LAYER_SCALE = 1.3;

/**
 * 单页内容在画框坐标系里的实际范围（世界单位，相对画框中心）：
 * 左侧留给翻起的卷边，上方留给堆叠的纸扇，下方几乎不用留。
 * 容器按它而不是整个画框来撑满可用区域，边距更小。
 */
export const MOBILE_CONTENT_EXTENT = { halfWidth: 0.63, top: 0.85, bottom: 0.71 } as const;
/** 内容与可用区域边缘之间保留的比例 */
export const MOBILE_FILL_MARGIN = 0.03;

export const mobileFrameAspect = () =>
  (MOBILE_FRAME.right - MOBILE_FRAME.left) / (MOBILE_FRAME.top - MOBILE_FRAME.bottom);

export const mobileFrameCenter = () => ({
  x: (MOBILE_FRAME.left + MOBILE_FRAME.right) / 2,
  y: (MOBILE_FRAME.bottom + MOBILE_FRAME.top) / 2,
});

export const mobileFov = () =>
  (2 * Math.atan((MOBILE_FRAME.top - MOBILE_FRAME.bottom) / 2 / MOBILE_CAMERA_Z) * 180) / Math.PI;

export const MOBILE_TUNING = {
  onHold: {
    startTime: 0.22,
    firstFlipTime: 1.4,
    fastestFlipTime: 1,
    speedUpSheets: 7,
    firstGapShare: 0.16,
    fastestGapShare: 0.1,
    moveSlopPx: 40,
  },
  onDrag: {
    turnFraction: 1.2,
    progressSmoothTime: 0.9,
    commitProgress: 0.1,
    clickSlopPx: 5,
    claimSteepness: 1.6,
    claimAfterPx: 4,
    fallTime: 1.3,
    fallTimeExponent: 0.5,
  },
  onClick: { flipTime: 1.2 },
  onEase: { settlePower: 0.8 },
  onGrab: { maxTiltDeg: 35, smoothTime: 0.05 },
  onWobble: { tiltDeg: 8, flipTimeMin: 0.95, flipTimeMax: 1.08 },
  onRolledOpen: {
    spineOpenStartDeg: 100,
    spineOpenEndDeg: 190,
    spineOpenPower: 4,
    coneEvenPower: 6,
    coverTopRadius: 0.04,
    backTopRadius: 0.18,
    coverBottomRadius: 0.01,
    backBottomRadius: 0.05,
    radiusSpacingClump: 7.5,
    radiusSpacingSeed: 41.5,
    fallDelayPages: 15,
    fallDurationPages: 3,
  },
  onShape: { midLeadPower: 2, midBow: 2, midBowFlatFrom: 0.3, midBowFlatTo: 0.8, midRollScale: 2.5 },
  onPile: {
    liftHeight: 0.08,
    liftPeakX: 0.4,
    liftEdgeDrop: 0.5,
    liftShutShare: 0.67,
    liftDepthFalloff: 0.5,
    coneTaper: -0.6,
    renderDepth: 3,
  },
  onBook: { pushBack: 0.05, pushRight: 0.02 },
  onCatchUp: { clump: 1.6, seed: 41 },
} as const;

const T = MOBILE_TUNING;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function smooth01(v: number): number {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
}

/** 确定性伪随机，用于给每张纸分配卷起半径 / 追赶节奏 */
export function hash(n: number, seed: number): number {
  const a = 43758.5453 * Math.sin(12.9898 * n + 78.233 * seed);
  return a - Math.floor(a);
}

// ---------- 手势 ----------

/** 触摸移动是否归翻页：横向超过起始距离，且纵向不够陡（否则留给浏览器纵向滚动） */
export function claimsHorizontalSwipe(dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return !(ax < T.onDrag.claimAfterPx) && ay < ax * T.onDrag.claimSteepness;
}

/** 拖拽进度：手指左移推进翻页，位移相对容器宽度 */
export function dragProgress(base: number, dx: number, rectWidth: number): number {
  return clamp(base - dx / rectWidth / T.onDrag.turnFraction, 0, 1);
}

/** 松手后落到哪一侧：朝翻页方向走过 commitProgress 才算翻过去 */
export function commitTarget(forward: boolean, progress: number, base: number): 0 | 1 {
  const committed = (forward ? progress - base : base - progress) >= T.onDrag.commitProgress;
  return forward === committed ? 1 : 0;
}

/** 翻页缓动：无 launch 时为带 settlePower 的余弦缓动；有 launch 时继承松手瞬间的速度 */
export function flipEase(r: number, launch?: number): number {
  const p = clamp(r, 0, 1);
  if (launch === undefined) {
    return 0.5 * (1 - Math.cos((1 - Math.pow(1 - p, T.onEase.settlePower)) * Math.PI));
  }
  const p2 = p * p;
  const p3 = p2 * p;
  return (p3 - 2 * p2 + p) * launch + (3 * p2 - 2 * p3);
}

/** 按住连翻：第 count 张的翻页时长与到下一张的间隔（秒），越翻越快 */
export function holdTiming(count: number): { flipTime: number; gap: number } {
  const h = T.onHold;
  const k = Math.min(count / h.speedUpSheets, 1);
  const flipTime = h.firstFlipTime + (h.fastestFlipTime - h.firstFlipTime) * k;
  const gapShare = h.firstGapShare + (h.fastestGapShare - h.firstGapShare) * k;
  return { flipTime, gap: flipTime * gapShare };
}

// ---------- 堆叠 ----------

/** 离当前页 depth 层的堆叠抬升量 */
export function pileLift(depth: number): number {
  const p = T.onPile;
  return p.liftHeight * (1 / (1 + depth * p.liftDepthFalloff)) * (1 - 0.002 * depth);
}

/** 抬升后纸面沿 x 的伸展补偿：抬升曲线弧长越长，水平可达距离越短 */
export function pileReach(lift: number): number {
  const p = T.onPile;
  if (lift <= 1e-6) return 1;
  const height = (x: number) => {
    const o = 1 - Math.min(x / p.liftPeakX, 1);
    return lift * Math.sqrt(1 - o * o) * (1 - p.liftEdgeDrop * smooth01((x - p.liftPeakX) / (1 - p.liftPeakX)));
  };
  let arc = 0;
  for (let i = 0; i < 6; i++) {
    const a = Math.pow(i / 6, 2);
    const b = Math.pow((i + 1) / 6, 2);
    arc += Math.hypot(b - a, height(b) - height(a));
  }
  return Math.max(2 - arc, 0.5);
}

// ---------- 整本杂志翻完后的「卷起」收尾 ----------

/** 追赶映射：把均匀的翻页总量 t 重新分配到 [0, x]，让每张纸的收尾节奏各不相同 */
export function buildCatchUp(count: number): number[] {
  const w: number[] = [];
  for (let i = 0; i < count; i++) w.push(Math.pow(hash(i + 1, T.onCatchUp.seed + 0.5), T.onCatchUp.clump));
  const sum = w.reduce((a, b) => a + b, 0);
  const Z = [0];
  let acc = 0;
  for (const e of w) {
    acc += sum > 0 ? (e / sum) * count : 1;
    Z.push(acc);
  }
  return Z;
}

export function catchUp(Z: number[], count: number, t: number): number {
  const i = Math.min(Math.floor(t), count);
  if (i >= count) return count;
  const a = Z[i];
  return a + (Z[i + 1] - a) * (t - i);
}

/** 每张纸卷起时的半径插值系数（0..1，按纸张序号递增） */
export function buildRadiusSpacing(count: number): number[] {
  const e = T.onRolledOpen;
  const w: number[] = [];
  for (let i = 0; i < count - 1; i++) w.push(Math.pow(hash(i + 1, e.radiusSpacingSeed), e.radiusSpacingClump));
  const sum = w.reduce((a, b) => a + b, 0);
  const even = 1 / w.length;
  const V = [0];
  let acc = 0;
  for (const v of w) {
    acc += 0.1 * even + 0.9 * (sum > 0 ? v / sum : even);
    V.push(acc);
  }
  return V;
}

/** 翻完最后一张之后的收尾进度 0..1（总翻页量越过 count-1 的部分） */
const tailProgress = (sum: number, count: number) => clamp(sum - (count - 1), 0, 1);
const endBlend = (sum: number, count: number) => smooth01((tailProgress(sum, count) - 0.6) / 0.4);

export interface SheetShapeInput {
  index: number;
  flipProgress: number;
  /** 所有纸张 flipProgress 之和：整本书的翻页总量 */
  sumProgress: number;
  count: number;
  /** 抓取点：x 为离书脊的远近(0..1)，y 为上下偏移(-1..1)，决定翻起时的倾斜 */
  grabX: number;
  grabY: number;
  wobbleTiltDeg: number;
  catchUp: number[];
  radii: number[];
}

export interface SheetShape {
  pileLift: [number, number, number];
  coneTaper: number;
  pileReach: [number, number];
  cone: [number, number, number];
  tailCurl: [number, number, number, number];
  tailBend: number;
  flipRotation: [number, number];
}

/** 一张纸当前的全部着色器参数 */
export function computeSheetShape(input: SheetShapeInput): SheetShape {
  const { index, flipProgress: b, sumProgress: sum, count: x, grabX, grabY, wobbleTiltDeg } = input;
  const open = T.onRolledOpen;
  const pile = T.onPile;

  const tt = catchUp(input.catchUp, x, sum);
  const spineOpen =
    ((open.spineOpenStartDeg +
      (open.spineOpenEndDeg - open.spineOpenStartDeg) *
        Math.pow(Math.min(tt / Math.max(1, x - 1), 1), open.spineOpenPower)) *
      Math.PI) /
    180;
  const end = endBlend(sum, x);
  const atEnd = tailProgress(sum, x) >= 1 ? 1 : 0;

  const fall = Math.max(
    smooth01((tt - (index + 1) - open.fallDelayPages) / Math.max(open.fallDurationPages, 0.001)),
    end
  );
  const radiusT = input.radii[index] ?? 0;
  const topR0 = open.coverTopRadius + (open.backTopRadius - open.coverTopRadius) * radiusT;
  const botR0 = open.coverBottomRadius + (open.backBottomRadius - open.coverBottomRadius) * radiusT;
  const even = Math.pow(x ? Math.min(tt / x, 1) : 0, open.coneEvenPower);
  const mid = (topR0 + botR0) / 2;
  const radii = {
    top: (topR0 + (mid - topR0) * even) * (1 - fall),
    bottom: (botR0 + (mid - botR0) * even) * (1 - fall),
  };

  const rolled = fall >= 1;
  const progressShare = x ? tt / x : 0;
  const remaining = Math.max(0, x - sum);
  const depth = rolled ? remaining + index : Math.max(0, index - sum);
  const settle = rolled
    ? Math.max(smooth01(tt - (index + 1) - open.fallDelayPages - open.fallDurationPages), atEnd)
    : (1 - b) * (1 - end);
  const shareNow = pile.liftShutShare + (1 - pile.liftShutShare) * progressShare;
  const liftNow = pileLift(depth) * (rolled ? pile.liftShutShare : shareNow);
  const lift = (liftNow + (pileLift(index) * pile.liftShutShare - liftNow) * end) * settle;

  const taperShare = shareNow + (pile.liftShutShare - shareNow) * end;
  const taperBase = pileLift(0) * Math.max(taperShare, 0.001);

  let pileLiftY = lift;
  let coneTaper = (pile.coneTaper * lift) / taperBase;

  const grabShrink = 1 - 0.5 * Math.max(grabY, 0) * grabX;
  const tiltDeg = grabY * (0.5 + 0.5 * grabX) * T.onGrab.maxTiltDeg + wobbleTiltDeg;
  const tiltRad = (tiltDeg * grabShrink * Math.PI) / 180;

  let cone: [number, number, number] = [0, 1, 0];
  let tailCurl: [number, number, number, number] = [1, 0, 1, 1];
  let tailBend = 0;
  let flipRotation: [number, number];

  if (rolled) {
    const ang = 2 * b * Math.PI;
    flipRotation = [Math.cos(ang), Math.sin(ang)];
  } else {
    const sh = T.onShape;
    const lead = 2 * Math.PI * (1 - Math.pow(1 - b, sh.midLeadPower));
    const full = 2 * Math.PI * b;
    const c = Math.min(lead, spineOpen);
    const p = lead - c;
    const u = p / Math.max(2 * Math.PI - spineOpen, 0.001);
    const rollScale = 1 + (sh.midRollScale - 1) * (1 - smooth01(u));
    const topR = Math.max(radii.top * rollScale, 1e-4);
    const spread = clamp((radii.bottom * rollScale - topR) / MOBILE_SHEET_ASPECT, -0.999, 0.999);
    const reach = (y: number) => {
      const r = Math.max(1e-5, topR + (HALF_H - y) * spread);
      const wrap = clamp(spread * p, -1.5, 1.5);
      return Math.abs(spread) < 1e-4 ? r * p : (r * Math.tan(wrap)) / spread;
    };
    const tilt = tiltRad + (Math.atan2(reach(-HALF_H) - reach(HALF_H), MOBILE_SHEET_ASPECT) - tiltRad) * smooth01(b);
    const cs = Math.cos(tilt);
    const sn = Math.sin(tilt);
    const along = Math.max(reach(HALF_H) * cs + HALF_H * sn, reach(-HALF_H) * cs - HALF_H * sn);
    const free = cs + HALF_H * Math.abs(sn) - along;
    const damp = 1 - smooth01(lead / spineOpen);

    pileLiftY *= damp;
    coneTaper *= damp;
    cone = [spread, topR, p];
    tailCurl = [cs, sn, along, Math.max(free, 0.001)];
    const bowFlat = 1 - smooth01((b - sh.midBowFlatFrom) / (sh.midBowFlatTo - sh.midBowFlatFrom));
    tailBend = Math.max(sh.midBow * bowFlat * Math.min(full - lead, 0), -lead);
    flipRotation = [Math.cos(c), Math.sin(c)];
  }

  return {
    pileLift: [pile.liftPeakX, pileLiftY, pile.liftEdgeDrop],
    coneTaper,
    pileReach: [pileReach(pileLiftY * (1 - 0.5 * coneTaper)), pileReach(pileLiftY * (1 + 0.5 * coneTaper))],
    cone,
    tailCurl,
    tailBend,
    flipRotation,
  };
}

/** 翻到末尾时整本书向右后方推开一点 */
export function bookOffset(sum: number, count: number, Z: number[]): { x: number; z: number } {
  const s = smooth01(count > 1 ? catchUp(Z, count, sum) / (count - 1) : 0) * (1 - endBlend(sum, count));
  return { x: T.onBook.pushRight * s, z: 0 - T.onBook.pushBack * s };
}

export function sheetVisible(index: number, current: number, sum: number, animating: boolean, count: number): boolean {
  return tailProgress(sum, count) > 0 || index <= current + T.onPile.renderDepth || animating;
}

export function sheetRenderOrder(index: number, current: number): number {
  return index < current ? current - 1 - index : index - current;
}

/**
 * 在 pW×pH 的可用区域里让内容尽量铺满：返回容器尺寸（宽高比固定为画框比）以及需要向下平移的像素，
 * 平移用来把「上方纸扇多、下方少」的内容范围整体居中。容器可以比可用区域大，超出的只是画框里的透明留白。
 */
export function mobileStageSize(
  pW: number,
  pH: number,
  /** 底部预留的像素（放提示条等），内容会整体上移避开它 */
  reserveBottom = 0
): { width: number; height: number; offsetY: number } {
  const c = MOBILE_CONTENT_EXTENT;
  const keep = 1 - MOBILE_FILL_MARGIN;
  const usableH = Math.max(pH - reserveBottom, 1);
  // u：每个世界单位对应的屏幕像素
  const u = Math.min((pW * keep) / (2 * c.halfWidth), (usableH * keep) / (c.top + c.bottom));
  const height = (u * (MOBILE_FRAME.top - MOBILE_FRAME.bottom)) / MOBILE_LAYER_SCALE;
  return {
    width: height * mobileFrameAspect(),
    height,
    offsetY: ((c.top - c.bottom) / 2) * u - reserveBottom / 2,
  };
}
