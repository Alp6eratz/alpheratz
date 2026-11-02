// Лента (ribbon) — узкая вертикальная панель кнопок слева, как в Obsidian.
// Кнопки собираются из всех включённых плагинов через PluginRegistry.
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommandService, PluginRegistry, RibbonItem } from '@lingua/core/plugin-api';

@Component({
  selector: 'lv-ribbon',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.horizontal]': "orientation() === 'horizontal'" },
  template: `
    <ng-template #btn let-item>
      @if (item.route) {
        <a
          mat-icon-button
          [routerLink]="item.route"
          routerLinkActive="active"
          [matTooltip]="item.tooltip"
          [matTooltipPosition]="tooltipPos()"
          [attr.aria-label]="item.tooltip"
        >
          <mat-icon>{{ item.icon }}</mat-icon>
        </a>
      } @else {
        <button
          mat-icon-button
          (click)="run(item)"
          [matTooltip]="item.tooltip"
          [matTooltipPosition]="tooltipPos()"
          [attr.aria-label]="item.tooltip"
        >
          <mat-icon>{{ item.icon }}</mat-icon>
        </button>
      }
    </ng-template>
    <div class="group">
      @for (item of top(); track item.id) {
        <ng-container *ngTemplateOutlet="btn; context: { $implicit: item }" />
      }
    </div>
    <div class="group">
      @for (item of bottom(); track item.id) {
        <ng-container *ngTemplateOutlet="btn; context: { $implicit: item }" />
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      width: 44px;
      padding: 8px 0;
      background: var(--lv-bg-secondary);
      border-right: 1px solid var(--lv-border);
    }
    :host(.horizontal) {
      flex-direction: row;
      width: auto;
      padding: 4px 8px;
      border-right: none;
      border-bottom: 1px solid var(--lv-border);
    }
    .group {
      display: flex;
      flex-direction: inherit;
      gap: 4px;
    }
    :host(.horizontal) .group {
      flex-direction: row;
    }
    a,
    button {
      --mat-icon-button-state-layer-size: 34px;
      padding: 5px;
      color: var(--lv-text-muted);
    }
    mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .active {
      color: var(--lv-accent);
    }
  `,
})
export class RibbonComponent {
  private readonly registry = inject(PluginRegistry);
  private readonly commands = inject(CommandService);
  private readonly router = inject(Router);

  /** Ориентация: вертикальная (десктоп) или горизонтальная (мобильное меню). */
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');
  /** Позиция подсказок. */
  readonly tooltipPos = computed(() => (this.orientation() === 'vertical' ? 'right' : 'below'));
  /** Верхние кнопки. */
  readonly top = computed(() => this.registry.ribbon().filter((i) => !i.bottom));
  /** Нижние кнопки. */
  readonly bottom = computed(() => this.registry.ribbon().filter((i) => i.bottom));

  /** Выполняет действие кнопки. */
  run(item: RibbonItem): void {
    if (item.commandId) this.commands.execute(item.commandId);
    else if (item.route) this.router.navigateByUrl(item.route);
  }
}
