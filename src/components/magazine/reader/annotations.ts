import { Pos, Run, Segment, findRun, segmentsOf } from './readerDoc';

export type AnnotationType = 'highlight' | 'underline' | 'wave' | 'strike';

export const ANNOTATION_COLORS = ['#F2C94C', '#6FCF97', '#56A0E0', '#EB6F92'] as const;

export interface Annotation {
  id: string;
  /** 跨元素选区会拆成多条，共享 groupId 统一删改 */
  groupId: string;
  type: AnnotationType;
  color: string;
  pageIndex: number;
  elementId: string;
  start: number;
  end: number;
  /** 原文引用，用于文本被编辑后重新定位 */
  quote: string;
  note?: string;
  createdAt: number;
}

export interface ResolvedAnnotation extends Annotation {
  from: number;
  to: number;
}

let seq = 0;
export const newId = () => `a${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createAnnotations(
  runs: Run[],
  a: Pos,
  b: Pos,
  style: { type: AnnotationType; color: string },
  makeGroupId: () => string = newId
): Annotation[] {
  const groupId = makeGroupId();
  return segmentsOf(runs, a, b).map((s: Segment) => ({
    id: newId(),
    groupId,
    type: style.type,
    color: style.color,
    pageIndex: s.run.pageIndex,
    elementId: s.run.elementId,
    start: s.from,
    end: s.to,
    quote: s.run.text.slice(s.from, s.to),
    createdAt: Date.now(),
  }));
}

/** 把存储的锚点对回当前文本；对不上的丢弃（文本已被改没） */
export function resolveAnnotations(list: Annotation[], runs: Run[]): ResolvedAnnotation[] {
  const out: ResolvedAnnotation[] = [];
  for (const a of list) {
    const run = findRun(runs, a.pageIndex, a.elementId);
    if (!run) continue;
    if (run.text.slice(a.start, a.end) === a.quote) {
      out.push({ ...a, from: a.start, to: a.end });
      continue;
    }
    const i = run.text.indexOf(a.quote);
    if (i >= 0 && a.quote !== '') out.push({ ...a, from: i, to: i + a.quote.length });
  }
  return out;
}

export const removeGroup = (list: Annotation[], groupId: string) => list.filter((a) => a.groupId !== groupId);

export const updateGroup = (list: Annotation[], groupId: string, patch: Partial<Pick<Annotation, 'type' | 'color'>>) =>
  list.map((a) => (a.groupId === groupId ? { ...a, ...patch } : a));

/** 笔记只挂在组内第一条上 */
export const setGroupNote = (list: Annotation[], groupId: string, note: string) => {
  let done = false;
  return list.map((a) => {
    if (a.groupId !== groupId) return a;
    if (done) return { ...a, note: undefined };
    done = true;
    return { ...a, note: note || undefined };
  });
};

// ---------- 持久化接口：宿主可自行实现 ----------

export interface AnnotationStore {
  load(): Annotation[] | Promise<Annotation[]>;
  save(list: Annotation[]): void | Promise<void>;
}

export interface ReaderState {
  annotations: Annotation[];
  bookmarks: number[];
}

export interface ReaderStore {
  load(): ReaderState | Promise<ReaderState>;
  save(state: ReaderState): void | Promise<void>;
}

export class LocalStorageReaderStore implements ReaderStore {
  constructor(private key = 'paper-mono-pager:reader:v1') {}
  load(): ReaderState {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          annotations: Array.isArray(p.annotations) ? p.annotations : [],
          bookmarks: Array.isArray(p.bookmarks) ? p.bookmarks.filter((n: unknown) => Number.isInteger(n)) : [],
        };
      }
    } catch {
      /* 存储不可用时按空处理 */
    }
    return { annotations: [], bookmarks: [] };
  }
  save(state: ReaderState) {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      /* 配额/隐私模式：忽略 */
    }
  }
}
