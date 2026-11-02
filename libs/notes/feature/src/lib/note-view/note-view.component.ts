// Страница заметки: редактируемый заголовок, редактор и/или просмотр в зависимости от режима вкладки.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VaultFacade, WorkspaceActions } from '@lingua/core/data-access';
import { EditorMode } from '@lingua/shared/models';
import { MarkdownEditorComponent } from '../editor/markdown-editor.component';
import { MarkdownPreviewComponent } from '../preview/markdown-preview.component';

@Component({
  selector: 'lv-note-view',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MarkdownEditorComponent,
    MarkdownPreviewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './note-view.component.html',
  styleUrl: './note-view.component.scss',
})
export class NoteViewComponent {
  private readonly store = inject(Store);
  private readonly snackBar = inject(MatSnackBar);
  private readonly title = inject(Title);
  readonly vault = inject(VaultFacade);

  /** Id заметки из маршрута (`withComponentInputBinding`). */
  readonly id = input.required<string>();
  /** Необязательный режим из query-параметра `?mode=edit`. */
  readonly mode = input<EditorMode | undefined>();

  /** Заметка из хранилища. */
  readonly note = computed(() => this.vault.entities()[this.id()] ?? null);
  /** Текущий режим вкладки. */
  readonly currentMode = this.vault.activeMode;
  /** Черновик текста: обновляется из хранилища, но локально меняется мгновенно для живого предпросмотра. */
  readonly draft = linkedSignal(() => this.note()?.content ?? '');
  /** Путь папки в виде «хлебных крошек». */
  readonly breadcrumbs = computed(() => this.note()?.folder.split('/').filter(Boolean) ?? []);

  constructor() {
    // Открываем вкладку при переходе на заметку (после загрузки хранилища).
    effect(() => {
      const id = this.id();
      const mode = this.mode();
      if (this.vault.loaded() && this.vault.entities()[id]) {
        untracked(() => this.store.dispatch(WorkspaceActions.openNote({ noteId: id, mode })));
      }
    });
    // Заголовок вкладки браузера.
    effect(() => this.title.setTitle(`${this.note()?.title ?? 'Заметка'} · LinguaVault`));
  }

  /** Сохраняет текст в хранилище. */
  save(content: string): void {
    const note = this.note();
    if (note && note.content !== content) this.vault.updateContent(note.id, content);
  }

  /** Изменение из просмотра (чекбокс) — сохраняем сразу. */
  onPreviewChange(content: string): void {
    this.draft.set(content);
    this.save(content);
  }

  /** Переименование по завершении редактирования заголовка. */
  rename(input: HTMLInputElement): void {
    const note = this.note();
    if (!note || input.value.trim() === note.title) {
      input.value = note?.title ?? '';
      return;
    }
    if (!this.vault.rename(note.id, input.value)) {
      this.snackBar.open('Заметка с таким названием уже существует', 'OK', { duration: 3000 });
      input.value = note.title;
    }
  }
}
