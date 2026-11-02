// Панель тегов: список всех тегов хранилища с количеством заметок.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VaultFacade } from '@lingua/core/data-access';

@Component({
  selector: 'lv-tags-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view-toolbar"><span class="view-title">Теги</span></div>
    @for (t of vault.tags(); track t.tag) {
      <button class="tag-row" (click)="vault.search('tag:#' + t.tag)">
        <span class="lv-tag">#{{ t.tag }}</span>
        <span class="count">{{ t.count }}</span>
      </button>
    } @empty {
      <div class="view-empty">Тегов пока нет. Добавьте #тег в заметку.</div>
    }
  `,
  styleUrl: './views.scss',
})
export class TagsViewComponent {
  readonly vault = inject(VaultFacade);
}
