/** 页序号（0 起）与对开页序号的换算：桌面双页布局下 0 = 封面，第 n 张纸正面是第 2n+1 页、背面是第 2n+2 页 */

/** 单页布局的页序号 → 双页布局的对开页序号 */
export function pageToSheet(pageIndex: number): number {
  return pageIndex <= 0 ? 0 : Math.floor((pageIndex + 1) / 2);
}

/** 对开页序号 → 左右页页码（1 起）；封面左侧、封底右侧为 null */
export function sheetToSpread(
  sheet: number,
  totalSheets: number,
  pageCount: number
): { left: number | null; right: number | null } {
  if (sheet <= 0) return { left: null, right: 1 };
  if (sheet >= totalSheets) return { left: totalSheets * 2, right: null };
  const right = sheet * 2 + 1;
  return { left: sheet * 2, right: right > pageCount ? null : right };
}
