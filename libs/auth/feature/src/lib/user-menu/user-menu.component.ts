// Меню пользователя на ленте: аватар с инициалами, имя, роль и выход.
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthFacade } from '@lingua/auth/data-access';
import { ROLE_LABELS } from '@lingua/shared/models';

@Component({
  selector: 'lv-user-menu',
  imports: [
    RouterLink,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user(); as user) {
      <button
        class="avatar"
        [class.admin]="auth.isAdmin()"
        [matMenuTriggerFor]="menu"
        [matTooltip]="user.name"
        [matTooltipPosition]="tooltip()"
        aria-label="Меню пользователя"
      >
        {{ initials() }}
      </button>
      <mat-menu #menu="matMenu">
        <div class="who" (click)="$event.stopPropagation()">
          <div class="name">{{ user.name }}</div>
          <div class="email">{{ user.email }}</div>
          <div class="role">{{ roleLabels[user.role] }}</div>
        </div>
        <mat-divider />
        <a mat-menu-item routerLink="/lessons"><mat-icon>school</mat-icon>Мои уроки</a>
        @if (auth.isAdmin()) {
          <a mat-menu-item routerLink="/admin"
            ><mat-icon>admin_panel_settings</mat-icon>Панель администратора</a
          >
        }
        <button mat-menu-item (click)="auth.logout()"><mat-icon>logout</mat-icon>Выйти</button>
      </mat-menu>
    }
  `,
  styles: `
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      font:
        600 0.8rem Inter,
        sans-serif;
      color: #fff;
      background: #3fb27f;
      &.admin {
        background: var(--lv-accent);
      }
    }
    .who {
      padding: 10px 16px 12px;
      min-width: 220px;
    }
    .name {
      font-weight: 600;
    }
    .email {
      font-size: 0.82rem;
      color: var(--lv-text-muted);
    }
    .role {
      margin-top: 6px;
      display: inline-block;
      font-size: 0.72rem;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--lv-active);
      color: var(--lv-accent);
    }
  `,
})
export class UserMenuComponent {
  readonly auth = inject(AuthFacade);
  readonly roleLabels = ROLE_LABELS;
  /** Положение подсказки (справа на десктопной ленте, снизу на мобильной). */
  readonly tooltip = input<'right' | 'below'>('right');
  /** Инициалы для аватара. */
  readonly initials = computed(() =>
    (this.auth.user()?.name ?? '?')
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );
}
