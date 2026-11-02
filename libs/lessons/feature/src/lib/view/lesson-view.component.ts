// Страница урока: материалы, заметка студента с отправкой на проверку и завершение урока.
// Заблокированный урок студенту не показывается — вместо него экран с замком.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthFacade } from '@lingua/auth/data-access';
import { LessonsFacade } from '@lingua/lessons/data-access';
import { MarkdownEditorComponent, MarkdownPreviewComponent } from '@lingua/notes/feature';
import { SUBMISSION_STATUS_LABELS } from '@lingua/shared/models';
import { MaterialViewerComponent } from '../shared/material-viewer.component';

@Component({
  selector: 'lv-lesson-view',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MarkdownEditorComponent,
    MarkdownPreviewComponent,
    MaterialViewerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lesson-view.component.html',
  styleUrl: './lesson-view.component.scss',
})
export class LessonViewComponent {
  readonly facade = inject(LessonsFacade);
  private readonly auth = inject(AuthFacade);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  readonly statusLabels = SUBMISSION_STATUS_LABELS;

  /** Id урока из маршрута. */
  readonly id = input.required<string>();

  /** Урок (только если он виден текущему пользователю). */
  readonly lesson = computed(() => this.facade.lessons().find((l) => l.id === this.id()) ?? null);
  /** Номер урока в курсе. */
  readonly number = computed(() => this.facade.lessons().findIndex((l) => l.id === this.id()) + 1);
  readonly access = computed(() => this.facade.access().get(this.id()) ?? null);
  readonly next = computed(() => this.facade.nextLesson(this.id()));

  /** Заметка студента к уроку. */
  readonly submission = computed(() => this.facade.mySubmission(this.id()));
  /** Черновик текста заметки. */
  readonly draft = linkedSignal(() => this.submission()?.content ?? '');
  /** Режим блока заметки: редактирование или просмотр. */
  readonly noteMode = signal<'edit' | 'preview'>('edit');
  /** Можно ли отправить заметку (есть текст и она не на проверке). */
  readonly canSubmit = computed(
    () => !!this.draft().trim() && this.submission()?.status !== 'submitted',
  );

  /** Заметки студентов к этому уроку (для администратора). */
  readonly studentNotes = computed(() => {
    const users = new Map(this.auth.users().map((u) => [u.id, u]));
    return this.facade
      .submissions()
      .filter((s) => s.lessonId === this.id() && s.status !== 'draft')
      .map((s) => ({ ...s, userName: users.get(s.userId)?.name ?? 'Удалённый пользователь' }));
  });

  constructor() {
    // Отмечаем начало урока, когда он доступен.
    effect(() => {
      const lesson = this.lesson();
      const access = this.access();
      if (lesson && access && !access.locked && !access.started && !this.facade.isAdmin()) {
        untracked(() => this.facade.startLesson(lesson.id));
      }
    });
    effect(() => this.titleService.setTitle(`${this.lesson()?.title ?? 'Урок'} · LinguaVault`));
  }

  /** Автосохранение черновика заметки. */
  saveDraft(content: string): void {
    if (content !== (this.submission()?.content ?? '')) this.facade.saveNote(this.id(), content);
  }

  /** Отправка заметки на проверку. */
  submit(): void {
    this.facade.saveNote(this.id(), this.draft(), true);
    this.snackBar.open('Заметка отправлена преподавателю на проверку', 'OK', { duration: 3000 });
  }

  /** Завершение урока. */
  complete(): void {
    const error = this.facade.completeLesson(this.id());
    if (error) {
      this.snackBar.open(error, 'OK', { duration: 4000 });
      return;
    }
    const next = this.next();
    this.snackBar
      .open('Урок завершён! 🎉', next ? 'Следующий урок' : 'К списку', { duration: 5000 })
      .onAction()
      .subscribe(() => this.router.navigate(next ? ['/lessons', next.id] : ['/lessons']));
  }
}
