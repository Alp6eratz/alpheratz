// Редактор Markdown: textarea с панелью форматирования, горячими клавишами
// и автодополнением [[вики-ссылок]]. Изменения отдаются наружу с задержкой (RxJS debounce).
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VaultFacade } from '@lingua/core/data-access';
import { debounceTime, Subject } from 'rxjs';

/** Описание кнопки панели форматирования. */
interface FormatAction {
  icon: string;
  tooltip: string;
  /** Текст до и после выделения. */
  before: string;
  after?: string;
  /** Вставлять в начало строки (заголовки, списки). */
  linePrefix?: boolean;
}

@Component({
  selector: 'lv-markdown-editor',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss',
})
export class MarkdownEditorComponent {
  private readonly vault = inject(VaultFacade);
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('area');

  /** Текст для редактирования. */
  readonly value = input.required<string>();
  /** Мгновенное изменение текста (для живого предпросмотра в раздельном режиме). */
  readonly valueInput = output<string>();
  /** Изменение текста с задержкой (для сохранения в хранилище). */
  readonly valueChange = output<string>();

  /** Поток ввода для debounce. */
  private readonly changes$ = new Subject<string>();

  /** Запрос автодополнения ссылки (текст после «[[») или null. */
  readonly linkQuery = signal<string | null>(null);
  /** Выделенная подсказка. */
  readonly suggestionIndex = signal(0);
  /** Подсказки заголовков заметок. */
  readonly suggestions = computed(() => {
    const q = this.linkQuery();
    if (q === null) return [];
    const lower = q.toLowerCase();
    return this.vault
      .notes()
      .filter((n) => n.title.toLowerCase().includes(lower))
      .slice(0, 8);
  });

  /** Кнопки панели форматирования. */
  readonly actions: FormatAction[] = [
    { icon: 'title', tooltip: 'Заголовок', before: '## ', linePrefix: true },
    { icon: 'format_bold', tooltip: 'Жирный (Ctrl+B)', before: '**', after: '**' },
    { icon: 'format_italic', tooltip: 'Курсив (Ctrl+I)', before: '*', after: '*' },
    { icon: 'ink_highlighter', tooltip: 'Выделение', before: '==', after: '==' },
    { icon: 'format_list_bulleted', tooltip: 'Список', before: '- ', linePrefix: true },
    { icon: 'check_box', tooltip: 'Задача', before: '- [ ] ', linePrefix: true },
    { icon: 'link', tooltip: 'Вики-ссылка', before: '[[', after: ']]' },
    { icon: 'style', tooltip: 'Карточка «слово :: перевод»', before: '', after: ' :: ' },
    { icon: 'code', tooltip: 'Код', before: '`', after: '`' },
    { icon: 'format_quote', tooltip: 'Callout', before: '> [!tip] ', linePrefix: true },
  ];

  constructor() {
    // Сохраняем не чаще, чем раз в 300 мс.
    this.changes$
      .pipe(debounceTime(300), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((v) => this.valueChange.emit(v));

    // Пишем значение в textarea только если оно действительно отличается (сохраняет позицию курсора).
    effect(() => {
      const el = this.textarea().nativeElement;
      const value = this.value();
      if (el.value !== value) el.value = value;
    });
  }

  /** Обработка ввода текста. */
  onInput(): void {
    const el = this.textarea().nativeElement;
    this.emit(el.value);
    // Проверяем, не набирает ли пользователь [[ссылку.
    const before = el.value.slice(0, el.selectionStart);
    const match = /\[\[([^\]\n]*)$/.exec(before);
    this.linkQuery.set(match ? match[1] : null);
    this.suggestionIndex.set(0);
  }

  /** Горячие клавиши редактора. */
  onKeydown(event: KeyboardEvent): void {
    const suggestions = this.suggestions();
    if (suggestions.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        this.suggestionIndex.update((i) => (i + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        this.completeLink(suggestions[this.suggestionIndex()].title);
        return;
      }
      if (event.key === 'Escape') {
        this.linkQuery.set(null);
        return;
      }
    }
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.code === 'KeyB') {
      event.preventDefault();
      this.apply(this.actions[1]);
    } else if (mod && event.code === 'KeyI') {
      event.preventDefault();
      this.apply(this.actions[2]);
    } else if (event.key === 'Tab') {
      // Tab вставляет отступ вместо перехода фокуса.
      event.preventDefault();
      this.insert('  ', '');
    }
  }

  /** Применяет действие форматирования к выделению. */
  apply(action: FormatAction): void {
    if (action.linePrefix) this.prefixLine(action.before);
    else this.insert(action.before, action.after ?? '');
  }

  /** Подставляет выбранный заголовок в [[ссылку]]. */
  completeLink(title: string): void {
    const el = this.textarea().nativeElement;
    const pos = el.selectionStart;
    const start = el.value.lastIndexOf('[[', pos);
    const hasClosing = el.value.slice(pos, pos + 2) === ']]';
    const next =
      el.value.slice(0, start) + `[[${title}]]` + el.value.slice(hasClosing ? pos + 2 : pos);
    this.replaceValue(next, start + title.length + 4);
    this.linkQuery.set(null);
  }

  /** Оборачивает выделение в before/after. */
  private insert(before: string, after: string): void {
    const el = this.textarea().nativeElement;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e);
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    const start = s + before.length;
    // Без префикса (например, карточка «::») курсор ставим после вставки, иначе — выделяем обёрнутый текст.
    if (!before) this.replaceValue(next, start + selected.length + after.length);
    else this.replaceValue(next, start + selected.length, start);
  }

  /** Добавляет префикс в начало текущей строки. */
  private prefixLine(prefix: string): void {
    const el = this.textarea().nativeElement;
    const lineStart = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const next = el.value.slice(0, lineStart) + prefix + el.value.slice(lineStart);
    this.replaceValue(next, el.selectionStart + prefix.length);
  }

  /** Заменяет текст, ставит курсор и уведомляет о изменении. */
  private replaceValue(next: string, cursor: number, selectionStart = cursor): void {
    const el = this.textarea().nativeElement;
    el.value = next;
    el.focus();
    el.setSelectionRange(selectionStart, cursor);
    this.emit(next);
  }

  /** Отправляет изменение наружу (мгновенно и с задержкой). */
  private emit(value: string): void {
    this.valueInput.emit(value);
    this.changes$.next(value);
  }

  /** Фокусирует редактор. */
  focus(): void {
    this.textarea().nativeElement.focus();
  }
}
