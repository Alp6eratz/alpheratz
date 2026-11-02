// NgRx-эффекты ядра: загрузка/сохранение данных и навигация после изменений вкладок.
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { AppSettings, Note } from '@lingua/shared/models';
import {
  debounceTime,
  defer,
  distinctUntilChanged,
  filter,
  from,
  map,
  skip,
  tap,
  withLatestFrom,
} from 'rxjs';
import { NotesActions } from './notes/notes.actions';
import { notesFeature, selectAllNotes } from './notes/notes.feature';
import { createSeedNotes, SEED_FOLDERS } from './seed/seed-notes';
import { SettingsActions } from './settings/settings.actions';
import { settingsFeature } from './settings/settings.feature';
import { STORAGE_KEYS, VaultStorage } from './storage/vault-storage';
import { WorkspaceActions } from './workspace/workspace.actions';
import { WorkspaceState, workspaceFeature } from './workspace/workspace.feature';

/**
 * При регистрации эффекта читает все данные из хранилища; при первом запуске создаёт демо-заметки.
 * Используется `defer`, а не ROOT_EFFECTS_INIT: так загрузка не зависит от порядка `provideEffects`.
 */
export const loadVault$ = createEffect(
  (storage = inject(VaultStorage)) =>
    defer(() => {
      const notes = storage.read<Note[]>(STORAGE_KEYS.notes);
      const folders = storage.read<string[]>(STORAGE_KEYS.folders) ?? [];
      const workspace = storage.read<Partial<WorkspaceState>>(STORAGE_KEYS.workspace) ?? {};
      const settings = storage.read<Partial<AppSettings>>(STORAGE_KEYS.settings) ?? {};
      return from([
        SettingsActions.restored({ settings }),
        WorkspaceActions.restored({ state: workspace }),
        notes
          ? NotesActions.vaultLoaded({ notes, folders })
          : NotesActions.vaultLoaded({ notes: createSeedNotes(), folders: SEED_FOLDERS }),
      ]);
    }),
  { functional: true },
);

/** Сброс хранилища к демо-данным. */
export const resetVault$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(NotesActions.vaultReset),
      map(() => NotesActions.vaultImported({ notes: createSeedNotes(), folders: SEED_FOLDERS })),
    ),
  { functional: true },
);

/** Сохраняет заметки и папки с задержкой (debounce), чтобы не писать на каждый символ. */
export const persistNotes$ = createEffect(
  (store = inject(Store), storage = inject(VaultStorage)) =>
    store.select(notesFeature.selectNotesState).pipe(
      filter((s) => s.loaded),
      debounceTime(400),
      withLatestFrom(store.select(selectAllNotes)),
      tap(([state, notes]) => {
        storage.write(STORAGE_KEYS.notes, notes);
        storage.write(STORAGE_KEYS.folders, state.folders);
      }),
    ),
  { functional: true, dispatch: false },
);

/** Сохраняет раскладку рабочей области. */
export const persistWorkspace$ = createEffect(
  (store = inject(Store), storage = inject(VaultStorage)) =>
    store.select(workspaceFeature.selectWorkspaceState).pipe(
      skip(1),
      debounceTime(300),
      // Поисковый запрос и активную заметку не сохраняем — активную определяет URL.
      map(({ tabs, leftOpen, rightOpen, leftView, rightView }) => ({
        tabs,
        leftOpen,
        rightOpen,
        leftView,
        rightView,
      })),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      tap((state) => storage.write(STORAGE_KEYS.workspace, state)),
    ),
  { functional: true, dispatch: false },
);

/** Сохраняет настройки. */
export const persistSettings$ = createEffect(
  (store = inject(Store), storage = inject(VaultStorage)) =>
    store.select(settingsFeature.selectSettingsState).pipe(
      skip(1),
      debounceTime(200),
      tap((settings) => storage.write(STORAGE_KEYS.settings, settings)),
    ),
  { functional: true, dispatch: false },
);

/** Открывает созданную заметку, если это было запрошено. */
export const openCreatedNote$ = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(NotesActions.noteCreated),
      filter(({ open }) => open),
      tap(({ note }) => router.navigate(['/note', note.id], { queryParams: { mode: 'edit' } })),
    ),
  { functional: true, dispatch: false },
);

/**
 * После закрытия вкладки/удаления заметки, если пользователь находился на этой заметке,
 * переходим к новой активной вкладке или на стартовую страницу.
 */
export const navigateAfterTabClose$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), router = inject(Router)) =>
    actions$.pipe(
      ofType(
        WorkspaceActions.closeTab,
        NotesActions.noteDeleted,
        NotesActions.folderDeleted,
        NotesActions.vaultImported,
      ),
      withLatestFrom(
        store.select(workspaceFeature.selectActiveNoteId),
        store.select(notesFeature.selectEntities),
      ),
      filter(() => router.url.startsWith('/note/')),
      tap(([, activeId, entities]) => {
        const currentId = router.url.split('/')[2]?.split('?')[0];
        if (currentId && entities[currentId] && currentId === activeId) return;
        router.navigate(activeId && entities[activeId] ? ['/note', activeId] : ['/']);
      }),
    ),
  { functional: true, dispatch: false },
);

/** Все эффекты ядра для `provideEffects`. */
export const coreEffects = {
  loadVault$,
  resetVault$,
  persistNotes$,
  persistWorkspace$,
  persistSettings$,
  openCreatedNote$,
  navigateAfterTabClose$,
};
