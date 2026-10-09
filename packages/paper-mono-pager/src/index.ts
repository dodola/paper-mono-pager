import './styles.css';
export {
  PaperMagazine,
  DEFAULT_PAPER_THEMES,
  type PaperMagazineProps,
  type PaperMagazineHandle,
  type PaperMagazinePageInfo,
  type PaperTheme,
} from './PaperMagazine';
export { CHINESE_PAGES, type PageContent } from './magazine/chinesePublicationData';
export { validateImportedPages } from './magazine/pageEdit';
export { MagazineEngine, type MagazineEngineOptions } from './magazine/MagazineEngine';
