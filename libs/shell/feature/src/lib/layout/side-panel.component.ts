// Боковая панель: переключатель видов (иконки сверху) и содержимое активного вида.
// Виды регистрируются плагинами (SidebarView), панель отображает их через NgComponentOutlet.
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PluginRegistry } from '@lingua/core/plugin-api';
import { WorkspaceActions, workspaceFeature } from '@lingua/core/data-access';

@Component({
  selector: 'lv-side-panel',
  imports: [NgComponentOutlet, MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tabs" role="tablist">
      @for (view of views(); track view.id) {
        <button
          mat-icon-button
          role="tab"
          [class.active]="view.id === active().id"
          [attr.aria-selected]="view.id === active().id"
          [matTooltip]="view.title"
          (click)="select(view.id)"
        >
          <mat-icon>{{ view.icon }}</mat-icon>
        </button>
      }
    </nav>
    <div class="content">
      @if (active(); as view) {
        <ng-container *ngComponentOutlet="view.component" />
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .tabs {
      display: flex;
      gap: 2px;
      padding: 6px 8px;
      border-bottom: 1px solid var(--lv-border);
    }
    .tabs button {
      --mat-icon-button-state-layer-size: 32px;
      padding: 4px;
      color: var(--lv-text-faint);
    }
    .tabs button.active {
      color: var(--lv-text);
      background: var(--lv-hover);
    }
    .tabs mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .content {
      flex: 1;
      overflow-y: auto;
    }
  `,
})
export class SidePanelComponent {
  private readonly registry = inject(PluginRegistry);
  private readonly store = inject(Store);

  /** Сторона панели. */
  readonly side = input.required<'left' | 'right'>();
  private readonly leftView = this.store.selectSignal(workspaceFeature.selectLeftView);
  private readonly rightView = this.store.selectSignal(workspaceFeature.selectRightView);

  /** Виды этой стороны. */
  readonly views = computed(() =>
    this.side() === 'left' ? this.registry.leftViews() : this.registry.rightViews(),
  );
  /** Активный вид (или первый доступный, если сохранённый отключён). */
  readonly active = computed(() => {
    const id = this.side() === 'left' ? this.leftView() : this.rightView();
    return this.views().find((v) => v.id === id) ?? this.views()[0] ?? null;
  });

  /** Выбирает вид. */
  select(view: string): void {
    this.store.dispatch(
      this.side() === 'left'
        ? WorkspaceActions.setLeftView({ view })
        : WorkspaceActions.setRightView({ view }),
    );
  }
}
