// Панель администратора: вкладки «Пользователи», «Проверка заметок» и «Прогресс по урокам».
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthFacade } from '@lingua/auth/data-access';
import { LessonsFacade, UserStats } from '@lingua/lessons/data-access';
import { MarkdownPreviewComponent } from '@lingua/notes/feature';
import {
  ROLE_LABELS,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
  UserRole,
} from '@lingua/shared/models';
import { DialogService } from '@lingua/shared/ui';

/** Вкладки панели. */
const TABS = ['users', 'reviews', 'lessons'] as const;
type Tab = (typeof TABS)[number];

/** Подписи активности студентов. */
export const ACTIVITY_LABELS: Record<UserStats['activity'], string> = {
  active: 'Занимается',
  idle: 'Не занимается',
  new: 'Не начинал',
};

@Component({
  selector: 'lv-admin-dashboard',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    MarkdownPreviewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  readonly auth = inject(AuthFacade);
  readonly lessons = inject(LessonsFacade);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly snackBar = inject(MatSnackBar);
  readonly roleLabels = ROLE_LABELS;
  readonly statusLabels = SUBMISSION_STATUS_LABELS;
  readonly activityLabels = ACTIVITY_LABELS;

  /** Активная вкладка из query-параметра `?tab=`. */
  readonly tab = input<string>();
  readonly tabIndex = computed(() => Math.max(0, TABS.indexOf((this.tab() ?? 'users') as Tab)));

  // ---------- Пользователи ----------
  readonly query = signal('');
  readonly activityFilter = signal<'all' | UserStats['activity']>('all');
  readonly roleFilter = signal<'all' | UserRole>('all');

  /** Отфильтрованная статистика пользователей. */
  readonly users = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.lessons
      .userStats()
      .filter((s) => this.roleFilter() === 'all' || s.user.role === this.roleFilter())
      .filter((s) => this.activityFilter() === 'all' || s.activity === this.activityFilter())
      .filter((s) => !q || `${s.user.name} ${s.user.email}`.toLowerCase().includes(q))
      .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''));
  });

  /** Сводка для плиток. */
  readonly summary = computed(() => {
    const students = this.lessons.userStats().filter((s) => s.user.role === 'student');
    return [
      { icon: 'group', label: 'Пользователей', value: this.lessons.userStats().length },
      { icon: 'school', label: 'Студентов', value: students.length },
      {
        icon: 'trending_up',
        label: 'Занимаются (7 дней)',
        value: students.filter((s) => s.activity === 'active').length,
      },
      { icon: 'rate_review', label: 'Ждут проверки', value: this.lessons.pendingReviews().length },
    ];
  });

  // ---------- Проверка заметок ----------
  readonly reviewFilter = signal<SubmissionStatus | 'all'>('submitted');
  /** Черновики комментариев преподавателя по id заметки. */
  readonly comments = signal<Record<string, string | undefined>>({});

  readonly reviews = computed(() => {
    const users = new Map(this.auth.users().map((u) => [u.id, u]));
    const lessons = new Map(this.lessons.allLessons().map((l) => [l.id, l]));
    return this.lessons
      .submissions()
      .filter((s) => s.status !== 'draft')
      .filter((s) => this.reviewFilter() === 'all' || s.status === this.reviewFilter())
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
      .map((s) => ({ ...s, user: users.get(s.userId), lesson: lessons.get(s.lessonId) }));
  });

  // ---------- Прогресс по урокам ----------
  readonly lessonStats = computed(() => {
    const students = this.auth.users().filter((u) => u.role === 'student');
    const ids = new Set(students.map((s) => s.id));
    return this.lessons.allLessons().map((lesson) => {
      const progress = this.lessons
        .progress()
        .filter((p) => p.lessonId === lesson.id && ids.has(p.userId));
      const completed = progress.filter((p) => p.completedAt).length;
      return {
        lesson,
        started: progress.length,
        completed,
        total: students.length,
        percent: students.length ? Math.round((completed / students.length) * 100) : 0,
        notes: this.lessons
          .submissions()
          .filter((s) => s.lessonId === lesson.id && s.status !== 'draft').length,
      };
    });
  });

  constructor() {
    // Свежий список пользователей при открытии панели.
    this.auth.loadUsers();
    // Ошибки операций с пользователями показываем во всплывающем сообщении.
    effect(() => {
      const error = this.auth.error();
      if (!error) return;
      this.snackBar.open(error, 'OK', { duration: 4000 });
      untracked(() => this.auth.clearError());
    });
  }

  /** Переключение вкладки с сохранением в URL. */
  selectTab(index: number): void {
    this.router.navigate([], { queryParams: { tab: TABS[index] }, replaceUrl: true });
  }

  /** Изменение роли. */
  changeRole(userId: string, role: UserRole): void {
    this.auth.changeRole(userId, role);
  }

  /** Удаление пользователя. */
  deleteUser(stats: UserStats): void {
    if (stats.user.id === this.auth.user()?.id) {
      this.snackBar.open('Нельзя удалить собственную учётную запись', 'OK', { duration: 3000 });
      return;
    }
    this.dialogs
      .confirm({
        title: 'Удалить пользователя?',
        message: `${stats.user.name} (${stats.user.email}) потеряет доступ к платформе.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .subscribe(() => this.auth.deleteUser(stats.user.id));
  }

  /** Сохраняет черновик комментария. */
  setComment(id: string, value: string): void {
    this.comments.update((c) => ({ ...c, [id]: value }));
  }

  /** Проверка заметки: принять или вернуть на доработку. */
  review(id: string, status: SubmissionStatus, current: string): void {
    const comment = this.comments()[id] ?? current;
    if (status === 'needs-work' && !comment.trim()) {
      this.snackBar.open('Напишите комментарий: что нужно доработать', 'OK', { duration: 3000 });
      return;
    }
    this.lessons.reviewSubmission(id, status, comment.trim());
    this.snackBar.open(
      status === 'reviewed' ? 'Заметка принята' : 'Заметка возвращена на доработку',
      'OK',
      { duration: 2500 },
    );
  }
}
