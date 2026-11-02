// Просмотр заметки: рендер Markdown в HTML и обработка кликов по интерактивным элементам
// (вики-ссылки, теги, кнопки озвучивания, чекбоксы задач) через делегирование событий.
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MarkdownService } from '@lingua/core/markdown';
import { SpeechService, VaultFacade } from '@lingua/core/data-access';

@Component({
  selector: 'lv-markdown-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lv-markdown' },
  template: `<article
    class="lv-markdown-body"
    [innerHTML]="html()"
    (click)="onClick($event)"
  ></article>`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class MarkdownPreviewComponent {
  private readonly markdown = inject(MarkdownService);
  private readonly vault = inject(VaultFacade);
  private readonly speech = inject(SpeechService);

  /** Исходный Markdown. */
  readonly content = input.required<string>();
  /** Изменение текста из просмотра (переключение чекбоксов задач). */
  readonly contentChange = output<string>();

  /** HTML, пересчитывается при изменении текста или списка заметок (для подсветки неразрешённых ссылок). */
  readonly html = computed(() => {
    const titles = this.vault.titleIndex();
    return this.markdown.render(this.content(), {
      resolveTitle: (t) => titles.get(t.toLowerCase()) ?? null,
    });
  });

  /** Делегированная обработка кликов внутри отрендеренного HTML. */
  onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    const link = target.closest<HTMLElement>('[data-wikilink]');
    if (link) {
      event.preventDefault();
      this.vault.openByTitle(link.dataset['wikilink'] ?? '');
      return;
    }

    const tag = target.closest<HTMLElement>('[data-tag]');
    if (tag) {
      event.preventDefault();
      this.vault.search(`tag:#${tag.dataset['tag']}`);
      return;
    }

    const speak = target.closest<HTMLElement>('[data-speak]');
    if (speak) {
      event.preventDefault();
      this.speech.speak(speak.dataset['speak'] ?? '');
      return;
    }

    if (target instanceof HTMLInputElement && target.classList.contains('lv-task')) {
      const boxes = Array.from(
        (event.currentTarget as HTMLElement).querySelectorAll('input.lv-task'),
      );
      this.toggleTask(boxes.indexOf(target));
    }
  }

  /** Переключает N-ю задачу «- [ ]» ↔ «- [x]» в исходном тексте. */
  private toggleTask(index: number): void {
    let i = -1;
    const next = this.content().replace(
      /^(\s*[-*+]\s+\[)( |x|X)(\])/gm,
      (match, open, mark, close) => {
        i++;
        return i === index ? `${open}${mark === ' ' ? 'x' : ' '}${close}` : match;
      },
    );
    this.contentChange.emit(next);
  }
}
