// Карточка пользователя для администратора: данные, роль и прогресс по каждому уроку.
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { AuthFacade } from '@lingua/auth/data-access';
import { LessonsFacade } from '@lingua/lessons/data-access';
import { ROLE_LABELS, SUBMISSION_STATUS_LABELS, UserRole } from '@lingua/shared/models';
import { ACTIVITY_LABELS } from '../dashboard/admin-dashboard.component';

@Component({
  selector: 'lv-user-detail',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <nav class="crumbs"><a routerLink="/admin">Администрирование</a> / Пользователь</nav>
      @if (stats(); as s) {
        <header class="head">
          <span class="avatar" [class.admin]="s.user.role === 'admin'">{{
            s.user.name.charAt(0).toUpperCase()
          }}</span>
          <div class="who">
            <h1>{{ s.user.name }}</h1>
            <div class="muted">{{ s.user.email }}</div>
            <div class="muted small">
              Зарегистрирован {{ s.user.createdAt | date: 'd MMM y' }} · последний вход
              {{ s.user.lastLoginAt ? (s.user.lastLoginAt | date: 'd MMM, HH:mm') : '—' }}
            </div>
          </div>
          <mat-select
            class="role"
            [value]="s.user.role"
            (valueChange)="changeRole(s.user.id, $event)"
            aria-label="Роль"
          >
            <mat-option value="student">{{ roleLabels.student }}</mat-option>
            <mat-option value="admin">{{ roleLabels.admin }}</mat-option>
          </mat-select>
        </header>

        <section class="overview">
          <div>
            <strong>{{ s.completed }} / {{ s.total }}</strong
            ><span>уроков пройдено</span>
          </div>
          <div>
            <strong>{{ s.percent }}%</strong><span>курса</span>
          </div>
          <div>
            <strong>{{ activityLabels[s.activity] }}</strong
            ><span>{{
              s.lastActivity ? (s.lastActivity | date: 'd MMM, HH:mm') : 'нет активности'
            }}</span>
          </div>
          <div>
            <strong>{{ s.pending }}</strong
            ><span>заметок ждут проверки</span>
          </div>
        </section>
        <mat-progress-bar mode="determinate" [value]="s.percent" />

        <h2>Уроки</h2>
        <ol class="lessons">
          @for (row of rows(); track row.lesson.id) {
            <li class="lesson">
              <mat-icon [class]="row.state">{{
                row.state === 'completed'
                  ? 'check_circle'
                  : row.state === 'started'
                    ? 'pending'
                    : 'radio_button_unchecked'
              }}</mat-icon>
              <div class="info">
                <a [routerLink]="['/lessons', row.lesson.id]"
                  >{{ row.lesson.order }}. {{ row.lesson.title }}</a
                >
                <div class="muted small">
                  @switch (row.state) {
                    @case ('completed') {
                      Завершён {{ row.completedAt | date: 'd MMM, HH:mm' }}
                    }
                    @case ('started') {
                      Начат {{ row.startedAt | date: 'd MMM, HH:mm' }}, не завершён
                    }
                    @default {
                      Не начат
                    }
                  }
                </div>
              </div>
              @if (row.note; as note) {
                <a
                  class="status"
                  [class]="note.status"
                  routerLink="/admin"
                  [queryParams]="{ tab: 'reviews' }"
                  >{{ statusLabels[note.status] }}</a
                >
              }
            </li>
          }
        </ol>
      } @else {
        <p class="muted">Пользователь не найден.</p>
      }
    </div>
  `,
  styles: `
    .page {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 24px 64px;
    }
    .crumbs {
      font-size: 0.85rem;
      color: var(--lv-text-faint);
      a {
        color: inherit;
      }
    }
    .head {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 16px 0 20px;
      flex-wrap: wrap;
      h1 {
        margin: 0;
        font-size: 1.5rem;
      }
    }
    .who {
      flex: 1;
      min-width: 200px;
    }
    .avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 1.4rem;
      font-weight: 700;
      color: #fff;
      background: #3fb27f;
      &.admin {
        background: var(--lv-accent);
      }
    }
    .role {
      width: 180px;
    }
    .muted {
      color: var(--lv-text-muted);
    }
    .small {
      font-size: 0.8rem;
    }
    .overview {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 12px;
      div {
        display: flex;
        flex-direction: column;
        padding: 14px;
        border-radius: 10px;
        background: var(--lv-bg-secondary);
        border: 1px solid var(--lv-border);
      }
      strong {
        font-size: 1.2rem;
      }
      span {
        color: var(--lv-text-muted);
        font-size: 0.82rem;
      }
    }
    h2 {
      margin: 28px 0 12px;
      font-size: 1.1rem;
    }
    .lessons {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .lesson {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 10px;
      background: var(--lv-bg-secondary);
      .info {
        flex: 1;
        min-width: 0;
        a {
          color: var(--lv-text);
          font-weight: 600;
          text-decoration: none;
        }
      }
      mat-icon.completed {
        color: #3fb27f;
      }
      mat-icon.started {
        color: #d99a1e;
      }
      mat-icon.none {
        color: var(--lv-text-faint);
      }
    }
    .status {
      font-size: 0.75rem;
      padding: 2px 10px;
      border-radius: 999px;
      text-decoration: none;
      background: var(--lv-hover);
      color: var(--lv-text-muted);
      &.submitted {
        background: var(--lv-active);
        color: var(--lv-accent);
      }
      &.needs-work {
        background: color-mix(in srgb, #d99a1e 20%, transparent);
        color: #d99a1e;
      }
      &.reviewed {
        background: color-mix(in srgb, #3fb27f 20%, transparent);
        color: #3fb27f;
      }
    }
    @media (max-width: 600px) {
      .page {
        padding: 16px 12px 48px;
      }
      .overview {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `,
})
export class UserDetailComponent {
  private readonly auth = inject(AuthFacade);
  private readonly lessons = inject(LessonsFacade);
  readonly roleLabels = ROLE_LABELS;
  readonly statusLabels = SUBMISSION_STATUS_LABELS;
  readonly activityLabels = ACTIVITY_LABELS;

  /** Id пользователя из маршрута. */
  readonly id = input.required<string>();

  readonly stats = computed(
    () => this.lessons.userStats().find((s) => s.user.id === this.id()) ?? null,
  );

  /** Состояние каждого опубликованного урока для пользователя. */
  readonly rows = computed(() =>
    this.lessons.publishedLessons().map((lesson) => {
      const p = this.lessons
        .progress()
        .find((x) => x.userId === this.id() && x.lessonId === lesson.id);
      const note = this.lessons
        .submissions()
        .find((s) => s.userId === this.id() && s.lessonId === lesson.id && s.status !== 'draft');
      return {
        lesson,
        state: p?.completedAt ? 'completed' : p ? 'started' : 'none',
        startedAt: p?.startedAt ?? null,
        completedAt: p?.completedAt ?? null,
        note: note ?? null,
      };
    }),
  );

  constructor() {
    this.auth.loadUsers();
  }

  changeRole(userId: string, role: UserRole): void {
    this.auth.changeRole(userId, role);
  }
}
