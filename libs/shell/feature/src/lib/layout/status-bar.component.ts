// Строка состояния внизу окна: статистика заметки и элементы, добавленные плагинами.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { PluginRegistry } from '@lingua/core/plugin-api';
import { VaultFacade } from '@lingua/core/data-access';

@Component({
  selector: 'lv-status-bar',
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (item of registry.statusBar(); track item.id) {
      <span class="item"><ng-container *ngComponentOutlet="item.component" /></span>
    }
    @if (vault.activeMeta(); as meta) {
      <span class="item">{{ meta.cards }} карт.</span>
      <span class="item">{{ meta.words }} слов</span>
      <span class="item">{{ vault.backlinks().length }} обр. ссылок</span>
    } @else {
      <span class="item">{{ vault.notes().length }} заметок</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      justify-content: flex-end;
      gap: 14px;
      padding: 3px 14px;
      font-size: 0.75rem;
      color: var(--lv-text-faint);
      background: var(--lv-bg-secondary);
      border-top: 1px solid var(--lv-border);
      white-space: nowrap;
      overflow: hidden;
    }
  `,
})
export class StatusBarComponent {
  readonly vault = inject(VaultFacade);
  readonly registry = inject(PluginRegistry);
}
