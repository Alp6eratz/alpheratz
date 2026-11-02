// Панель «Структура»: оглавление активной заметки с прокруткой к заголовку.
import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { VaultFacade } from '@lingua/core/data-access';

@Component({
  selector: 'lv-outline-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view-toolbar"><span class="view-title">Структура</span></div>
    @for (h of vault.activeMeta()?.headings ?? []; track $index) {
      <button
        class="outline-row"
        [style.padding-left.px]="8 + (h.level - 1) * 14"
        (click)="scrollTo(h.slug)"
      >
        {{ h.text }}
      </button>
    } @empty {
      <div class="view-empty">Заголовков нет</div>
    }
  `,
  styleUrl: './views.scss',
})
export class OutlineViewComponent {
  readonly vault = inject(VaultFacade);
  private readonly document = inject(DOCUMENT);

  /** Плавно прокручивает область просмотра к заголовку. */
  scrollTo(slug: string): void {
    this.document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
