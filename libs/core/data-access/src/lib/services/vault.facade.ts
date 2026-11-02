// Фасад хранилища: единая точка доступа к заметкам для компонентов и плагинов.
// Скрывает детали NgRx (действия/селекторы) за простыми сигналами и методами.
import { computed, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { EditorMode, NewNote, Note } from '@lingua/shared/models';
import { createId, snippetAround } from '@lingua/shared/util';
import { NotesActions } from '../notes/notes.actions';
import { notesFeature, selectAllNotes, selectNoteEntities } from '../notes/notes.feature';
import {
  selectActiveBacklinks,
  selectActiveNote,
  selectActiveNoteMeta,
  selectActiveOutgoingLinks,
  selectAllFolders,
  selectFileTree,
  selectNotesMeta,
  selectOpenTabs,
  selectRecentNotes,
  selectTagIndex,
  selectTitleIndex,
} from '../notes/notes.selectors';
import { settingsFeature } from '../settings/settings.feature';
import { WorkspaceActions } from '../workspace/workspace.actions';
import { workspaceFeature } from '../workspace/workspace.feature';

/** Результат полнотекстового поиска. */
export interface SearchResult {
  note: Note;
  snippet: string;
  /** Совпадение в заголовке ценнее, чем в тексте. */
  score: number;
}

@Injectable({ providedIn: 'root' })
export class VaultFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  // ---------- Сигналы состояния ----------
  readonly loaded = this.store.selectSignal(notesFeature.selectLoaded);
  readonly notes = this.store.selectSignal(selectAllNotes);
  readonly entities = this.store.selectSignal(selectNoteEntities);
  readonly meta = this.store.selectSignal(selectNotesMeta);
  readonly titleIndex = this.store.selectSignal(selectTitleIndex);
  readonly folders = this.store.selectSignal(selectAllFolders);
  readonly fileTree = this.store.selectSignal(selectFileTree);
  readonly tags = this.store.selectSignal(selectTagIndex);
  readonly recent = this.store.selectSignal(selectRecentNotes);
  readonly tabs = this.store.selectSignal(selectOpenTabs);
  readonly activeNote = this.store.selectSignal(selectActiveNote);
  readonly activeMeta = this.store.selectSignal(selectActiveNoteMeta);
  readonly backlinks = this.store.selectSignal(selectActiveBacklinks);
  readonly outgoingLinks = this.store.selectSignal(selectActiveOutgoingLinks);
  readonly searchQuery = this.store.selectSignal(workspaceFeature.selectSearchQuery);
  readonly settings = this.store.selectSignal(settingsFeature.selectSettingsState);

  /** Режим активной вкладки. */
  readonly activeMode = computed<EditorMode>(() => {
    const active = this.activeNote();
    return (
      this.tabs().find((t) => t.noteId === active?.id)?.mode ?? this.settings().defaultEditorMode
    );
  });

  // ---------- Работа с заметками ----------

  /** Возвращает свободный заголовок: «Без названия», «Без названия 1», … */
  uniqueTitle(base: string): string {
    const taken = this.titleIndex();
    if (!taken.has(base.toLowerCase())) return base;
    let i = 1;
    while (taken.has(`${base} ${i}`.toLowerCase())) i++;
    return `${base} ${i}`;
  }

  /** Создаёт заметку и (по умолчанию) открывает её. Возвращает созданную заметку. */
  createNote(data: NewNote, open = true): Note {
    const now = new Date().toISOString();
    const title = this.uniqueTitle(data.title.trim() || 'Без названия');
    const note: Note = {
      id: createId(),
      title,
      folder: data.folder,
      content: data.content ?? '',
      createdAt: now,
      updatedAt: now,
    };
    this.store.dispatch(NotesActions.noteCreated({ note, open }));
    return note;
  }

  /** Обновляет текст заметки. */
  updateContent(id: string, content: string): void {
    this.store.dispatch(
      NotesActions.contentChanged({ id, content, updatedAt: new Date().toISOString() }),
    );
  }

  /** Переименовывает заметку (если заголовок свободен). Возвращает false при конфликте. */
  rename(id: string, title: string): boolean {
    const clean = title.trim().replace(/[[\]|#]/g, '');
    if (!clean) return false;
    const existing = this.titleIndex().get(clean.toLowerCase());
    if (existing && existing !== id) return false;
    this.store.dispatch(
      NotesActions.noteRenamed({ id, title: clean, updatedAt: new Date().toISOString() }),
    );
    return true;
  }

  /** Перемещает заметку в папку. */
  move(id: string, folder: string): void {
    this.store.dispatch(NotesActions.noteMoved({ id, folder }));
  }

  /** Удаляет заметку. */
  delete(id: string): void {
    this.store.dispatch(NotesActions.noteDeleted({ id }));
  }

  /** Создаёт папку. */
  createFolder(path: string): void {
    const clean = path
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean)
      .join('/');
    if (clean) this.store.dispatch(NotesActions.folderCreated({ path: clean }));
  }

  /** Удаляет папку со всем содержимым. */
  deleteFolder(path: string): void {
    this.store.dispatch(NotesActions.folderDeleted({ path }));
  }

  /** Импортирует хранилище целиком. */
  importVault(notes: Note[], folders: string[]): void {
    this.store.dispatch(NotesActions.vaultImported({ notes, folders }));
  }

  /** Сбрасывает хранилище к демонстрационным данным. */
  resetVault(): void {
    this.store.dispatch(NotesActions.vaultReset());
  }

  // ---------- Навигация ----------

  /** Открывает заметку по id. */
  open(id: string, mode?: EditorMode): void {
    this.router.navigate(['/note', id], { queryParams: mode ? { mode } : {} });
  }

  /** Открывает заметку по заголовку; если её нет — создаёт (поведение Obsidian). */
  openByTitle(title: string): void {
    const id = this.titleIndex().get(title.trim().toLowerCase());
    if (id) this.open(id);
    else this.createNote({ title: title.trim(), folder: this.activeNote()?.folder ?? '' });
  }

  /** Открывает (или создаёт) заметку дневника на сегодня — удобно для ежедневной практики языка. */
  openDailyNote(): void {
    const date = new Date().toISOString().slice(0, 10);
    const id = this.titleIndex().get(date);
    if (id) {
      this.open(id);
      return;
    }
    this.createNote({
      title: date,
      folder: 'Дневник',
      content: `#дневник\n\n## Новые слова\n\nword :: слово\n\n## Мысли на изучаемом языке\n\n`,
    });
  }

  /** Запускает поиск в левой панели. */
  search(query: string): void {
    this.store.dispatch(WorkspaceActions.search({ query }));
  }

  /** Полнотекстовый поиск. Поддерживает префикс `tag:` (например `tag:#глаголы`). */
  find(query: string): SearchResult[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const meta = this.meta();
    if (q.startsWith('tag:') || q.startsWith('#')) {
      const tag = q.replace(/^tag:/, '').replace(/^#/, '');
      return this.notes()
        .filter((n) => meta.get(n.id)?.tags.some((t) => t === tag || t.startsWith(tag + '/')))
        .map((note) => ({ note, snippet: snippetAround(note.content, '#' + tag), score: 1 }));
    }
    return this.notes()
      .map((note) => {
        const inTitle = note.title.toLowerCase().includes(q);
        const inBody = note.content.toLowerCase().includes(q);
        return {
          note,
          snippet: snippetAround(note.content, q),
          score: (inTitle ? 2 : 0) + (inBody ? 1 : 0),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }
}
