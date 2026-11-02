// Сервис рендеринга Markdown → безопасный HTML.
// Собирает экземпляр marked из встроенных расширений и расширений включённых плагинов.
import { computed, inject, Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PluginRegistry } from '@lingua/core/plugin-api';
import { slugify } from '@lingua/shared/util';
import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import { CORE_MARKDOWN_EXTENSIONS, RenderContext, setRenderContext } from './extensions';

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly registry = inject(PluginRegistry);
  private readonly sanitizer = inject(DomSanitizer);

  /** Экземпляр marked пересоздаётся при включении/отключении плагинов. */
  private readonly marked = computed(() => {
    const instance = new Marked({ gfm: true, breaks: false });
    instance.use(...CORE_MARKDOWN_EXTENSIONS, ...this.registry.markdownExtensions());
    // Заголовкам добавляем id, чтобы панель «Структура» могла прокручивать к ним.
    instance.use({
      renderer: {
        heading({ tokens, depth, text }) {
          return `<h${depth} id="${slugify(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
        },
        // Чекбоксы задач делаем «живыми» (атрибут для обработчика кликов).
        checkbox({ checked }) {
          return `<input type="checkbox" class="lv-task" ${checked ? 'checked' : ''}> `;
        },
      },
    });
    return instance;
  });

  /** Рендерит Markdown в очищенную HTML-строку. */
  renderToString(markdown: string, context?: RenderContext): string {
    if (context) setRenderContext(context);
    const html = this.marked().parse(markdown, { async: false }) as string;
    // DOMPurify защищает от XSS; data-* атрибуты сохраняются для интерактивности.
    return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  }

  /** Рендерит Markdown в SafeHtml для привязки `[innerHTML]`. */
  render(markdown: string, context?: RenderContext): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.renderToString(markdown, context));
  }

  /** Рендерит короткий фрагмент без обёртки <p> (для карточек и подписей). */
  renderInline(markdown: string, context?: RenderContext): SafeHtml {
    if (context) setRenderContext(context);
    const html = this.marked().parseInline(markdown, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(html));
  }
}
