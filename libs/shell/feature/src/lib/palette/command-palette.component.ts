// Палитра команд (Ctrl+P) и быстрый переход к заметке (Ctrl+O) — как в Obsidian.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CommandService, formatHotkey } from '@lingua/core/plugin-api';
import { VaultFacade } from '@lingua/core/data-access';

/** Режим палитры. */
export type PaletteMode = 'commands' | 'notes';

/** Элемент списка палитры. */
interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  action: () => void;
}

@Component({
  selector: 'lv-command-palette',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="palette" (keydown)="onKey($event)">
      <input
        #input
        class="palette-input"
        [placeholder]="mode === 'commands' ? 'Выберите команду…' : 'Найдите или создайте заметку…'"
        [value]="query()"
        (input)="setQuery(input.value)"
        autocomplete="off"
        aria-label="Поиск"
      />
      <div class="palette-list" role="listbox">
        @for (item of items(); track item.id; let i = $index) {
          <button
            class="palette-item"
            role="option"
            [class.selected]="i === selected()"
            [attr.aria-selected]="i === selected()"
            (mouseenter)="selected.set(i)"
            (click)="choose(item)"
          >
            <mat-icon>{{ item.icon }}</mat-icon>
            <span class="label">{{ item.label }}</span>
            @if (item.hint) {
              <span class="hint">{{ item.hint }}</span>
            }
          </button>
        } @empty {
          <div class="palette-empty">Ничего не найдено</div>
        }
      </div>
      <div class="palette-footer">
        <span><kbd>↑↓</kbd> навигация</span><span><kbd>↵</kbd> выбрать</span
        ><span><kbd>esc</kbd> закрыть</span>
      </div>
    </div>
  `,
  styleUrl: './command-palette.component.scss',
})
export class CommandPaletteComponent {
  /** Режим, переданный при открытии. */
  readonly mode = inject<PaletteMode>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<CommandPaletteComponent>);
  private readonly commands = inject(CommandService);
  private readonly vault = inject(VaultFacade);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  /** Текст запроса. */
  readonly query = signal('');
  /** Индекс выделенного элемента. */
  readonly selected = signal(0);

  /** Отфильтрованный список элементов в зависимости от режима. */
  readonly items = computed<PaletteItem[]>(() => {
    const q = this.query().trim();
    if (this.mode === 'commands') {
      return this.commands.search(q).map((c) => ({
        id: c.id,
        label: c.name,
        icon: c.icon ?? 'bolt',
        hint: c.hotkey ? formatHotkey(c.hotkey) : undefined,
        action: () => this.commands.run(c),
      }));
    }
    const lower = q.toLowerCase();
    const notes = this.vault
      .notes()
      .filter(
        (n) =>
          !lower || n.title.toLowerCase().includes(lower) || n.folder.toLowerCase().includes(lower),
      )
      .sort((a, b) =>
        lower
          ? a.title.toLowerCase().indexOf(lower) - b.title.toLowerCase().indexOf(lower)
          : b.updatedAt.localeCompare(a.updatedAt),
      )
      .slice(0, 50)
      .map<PaletteItem>((n) => ({
        id: n.id,
        label: n.title,
        hint: n.folder,
        icon: 'description',
        action: () => this.vault.open(n.id),
      }));
    // Если точного совпадения нет — предлагаем создать заметку.
    if (q && !this.vault.titleIndex().has(lower)) {
      notes.push({
        id: '__create',
        label: `Создать «${q}»`,
        icon: 'add',
        action: () => this.vault.createNote({ title: q, folder: '' }),
      });
    }
    return notes;
  });

  constructor() {
    // Фокус на поле ввода после открытия диалога.
    this.ref.afterOpened().subscribe(() => this.input().nativeElement.focus());
  }

  /** Обновляет запрос и сбрасывает выделение. */
  setQuery(value: string): void {
    this.query.set(value);
    this.selected.set(0);
  }

  /** Клавиатурная навигация по списку. */
  onKey(event: KeyboardEvent): void {
    const count = this.items().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selected.update((i) => (i + 1) % Math.max(count, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selected.update((i) => (i - 1 + count) % Math.max(count, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.items()[this.selected()];
      if (item) this.choose(item);
    }
  }

  /** Выполняет действие элемента и закрывает палитру. */
  choose(item: PaletteItem): void {
    this.ref.close();
    item.action();
  }

  /** Открывает палитру в нужном режиме (статический помощник для команд). */
  static open(dialog: MatDialog, mode: PaletteMode): void {
    if (dialog.openDialogs.some((d) => d.componentInstance instanceof CommandPaletteComponent))
      return;
    dialog.open(CommandPaletteComponent, {
      data: mode,
      width: '640px',
      maxWidth: '94vw',
      position: { top: '12vh' },
      panelClass: 'lv-palette-panel',
      autoFocus: false,
    });
  }
}
