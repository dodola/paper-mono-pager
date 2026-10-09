import type { ReaderPageOverlay } from './overlayPainter';

/** 阅读器需要的引擎能力：桌面双页引擎与移动端单页引擎都实现它 */
export interface ReaderEngineHost {
  getContainer(): HTMLElement;
  getHitArea(): HTMLElement;
  isEditing(): boolean;
  /** 返回 true 时引擎不再把这次按下当作翻页 */
  setPointerInterceptor(fn: ((e: PointerEvent) => boolean) | null): void;
  setPageReaderOverlay(pageIndex: number, overlay: ReaderPageOverlay | null): void;
  getLeftPageIndex(): number | null;
  getRightPageIndex(): number | null;
  getCanvasCoordsFromClient(
    clientX: number,
    clientY: number
  ): { pageIndex: number; side: 'left' | 'right'; canvasX: number; canvasY: number } | null;
  /** 跳到包含该页（从 0 起）的位置 */
  goToPage(pageIndex: number): void;
}
