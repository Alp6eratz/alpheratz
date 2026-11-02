// Производные селекторы: метаданные заметок, теги, обратные ссылки, граф связей, дерево файлов.
import { createSelector } from '@ngrx/store';
import { Note, NoteHeading } from '@lingua/shared/models';
import {
  buildFileTree,
  collectFolders,
  extractCardPairs,
  extractHeadings,
  extractTags,
  extractWikiLinks,
} from '@lingua/shared/util';
import { workspaceFeature } from '../workspace/workspace.feature';
import { notesFeature, selectAllNotes, selectNoteEntities } from './notes.feature';

/** Метаданные, вычисленные из текста заметки. */
export interface NoteMeta {
  tags: string[];
  links: string[];
  headings: NoteHeading[];
  words: number;
  cards: number;
}

/** Узел и ребро графа связей. */
export interface GraphData {
  nodes: { id: string; title: string; tags: string[]; degree: number }[];
  edges: { source: string; target: string }[];
}

/** Подсчёт слов (поддерживает любые алфавиты). */
const countWords = (text: string) => (text.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

/** Словарь «заголовок в нижнем регистре → id» для разрешения [[ссылок]]. */
export const selectTitleIndex = createSelector(selectAllNotes, (notes) => {
  const map = new Map<string, string>();
  notes.forEach((n) => map.set(n.title.toLowerCase(), n.id));
  return map;
});

/** Метаданные всех заметок (мемоизированы — пересчёт только при изменении заметок). */
export const selectNotesMeta = createSelector(selectAllNotes, (notes) => {
  const map = new Map<string, NoteMeta>();
  for (const n of notes) {
    map.set(n.id, {
      tags: extractTags(n.content),
      links: extractWikiLinks(n.content),
      headings: extractHeadings(n.content),
      words: countWords(n.content),
      cards: extractCardPairs(n.content).length,
    });
  }
  return map;
});

/** Индекс тегов: тег → количество и список заметок. */
export const selectTagIndex = createSelector(selectNotesMeta, (meta) => {
  const index = new Map<string, string[]>();
  meta.forEach((m, id) => m.tags.forEach((t) => index.set(t, [...(index.get(t) ?? []), id])));
  return [...index.entries()]
    .map(([tag, noteIds]) => ({ tag, count: noteIds.length, noteIds }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ru'));
});

/** Все папки: явно созданные + выведенные из путей заметок. */
export const selectAllFolders = createSelector(
  selectAllNotes,
  notesFeature.selectFolders,
  (notes, folders) => [...new Set([...collectFolders(notes), ...folders])].sort(),
);

/** Дерево файлового проводника. */
export const selectFileTree = createSelector(
  selectAllNotes,
  notesFeature.selectFolders,
  (notes, folders) => buildFileTree(notes, folders),
);

/** Граф связей между заметками для плагина «Граф». */
export const selectGraphData = createSelector(
  selectAllNotes,
  selectNotesMeta,
  selectTitleIndex,
  (notes, meta, titles): GraphData => {
    const edges: GraphData['edges'] = [];
    const degree = new Map<string, number>();
    for (const n of notes) {
      for (const link of meta.get(n.id)?.links ?? []) {
        const target = titles.get(link.toLowerCase());
        if (target && target !== n.id) {
          edges.push({ source: n.id, target });
          degree.set(n.id, (degree.get(n.id) ?? 0) + 1);
          degree.set(target, (degree.get(target) ?? 0) + 1);
        }
      }
    }
    return {
      nodes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        tags: meta.get(n.id)?.tags ?? [],
        degree: degree.get(n.id) ?? 0,
      })),
      edges,
    };
  },
);

/** Активная (открытая) заметка. */
export const selectActiveNote = createSelector(
  selectNoteEntities,
  workspaceFeature.selectActiveNoteId,
  (entities, id): Note | null => (id ? (entities[id] ?? null) : null),
);

/** Метаданные активной заметки. */
export const selectActiveNoteMeta = createSelector(
  selectNotesMeta,
  workspaceFeature.selectActiveNoteId,
  (meta, id) => (id ? (meta.get(id) ?? null) : null),
);

/** Обратные ссылки на активную заметку: кто ссылается на неё. */
export const selectActiveBacklinks = createSelector(
  selectAllNotes,
  selectNotesMeta,
  selectActiveNote,
  (notes, meta, active) => {
    if (!active) return [];
    const title = active.title.toLowerCase();
    return notes.filter(
      (n) => n.id !== active.id && meta.get(n.id)?.links.some((l) => l.toLowerCase() === title),
    );
  },
);

/** Исходящие ссылки активной заметки с признаком «существует ли цель». */
export const selectActiveOutgoingLinks = createSelector(
  selectActiveNoteMeta,
  selectTitleIndex,
  (meta, titles) =>
    (meta?.links ?? []).map((title) => ({ title, id: titles.get(title.toLowerCase()) ?? null })),
);

/** Последние изменённые заметки для стартовой страницы. */
export const selectRecentNotes = createSelector(selectAllNotes, (notes) =>
  [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
);

/** Открытые вкладки вместе с заметками (вкладки удалённых заметок отбрасываются). */
export const selectOpenTabs = createSelector(
  workspaceFeature.selectTabs,
  selectNoteEntities,
  (tabs, entities) =>
    tabs.filter((t) => entities[t.noteId]).map((t) => ({ ...t, note: entities[t.noteId] as Note })),
);
