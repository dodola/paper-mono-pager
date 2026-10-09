/**
 * 桌面双页引擎的纹理窗口。
 *
 * 一页纹理约占 26–38MB（11MB 的 CPU 画布 + GPU 纹理与 mipmap），全书同时驻留在几十页时就不可用，
 * 因此只为当前对开页附近的页持有纹理，翻到哪里加载到哪里，离开后释放。窗口大小与总页数无关。
 */

/**
 * 当前对开页 currentSheet 前后各 radius 张纸所覆盖的页序号闭区间（0 起）。
 * currentSheet = 已翻过的纸张数：可见的左页在第 currentSheet-1 张背面，右页在第 currentSheet 张正面。
 */
export function desktopPageRange(
  currentSheet: number,
  totalSheets: number,
  pageCount: number,
  radius: number
): [number, number] {
  const loSheet = Math.max(0, currentSheet - 1 - radius);
  const hiSheet = Math.min(totalSheets - 1, currentSheet + radius);
  return [loSheet * 2, Math.min(hiSheet * 2 + 1, pageCount - 1)];
}

/**
 * 对比已持有纹理的页与应保留区间，给出要新建与要释放的页。
 * margin 是释放时的余量：区间外 margin 页以内暂不释放，避免来回翻页时反复生成。
 */
export function planTextures(
  held: Iterable<number>,
  keep: [number, number],
  margin: number
): { build: number[]; release: number[] } {
  const [lo, hi] = keep;
  const have = new Set(held);
  const build: number[] = [];
  for (let i = lo; i <= hi; i++) if (!have.has(i)) build.push(i);
  const release = [...have].filter((i) => i < lo - margin || i > hi + margin).sort((a, b) => a - b);
  return { build, release };
}
