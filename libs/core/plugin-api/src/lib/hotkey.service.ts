// Глобальные горячие клавиши: слушает клавиатуру и запускает команды с совпадающим `hotkey`.
import { DestroyRef, DOCUMENT, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, map } from 'rxjs';
import { CommandService } from './command.service';

/** Преобразует событие клавиатуры в строку вида `Mod+Shift+P`. */
export function eventToHotkey(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('Mod');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  parts.push(event.code.startsWith('Key') ? event.code.slice(3) : key);
  return parts.join('+');
}

/** Отображаемое название сочетания для текущей ОС. */
export function formatHotkey(hotkey: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return hotkey.replace('Mod', isMac ? '⌘' : 'Ctrl');
}

@Injectable({ providedIn: 'root' })
export class HotkeyService {
  private readonly document = inject(DOCUMENT);
  private readonly commands = inject(CommandService);
  private readonly destroyRef = inject(DestroyRef);

  /** Запускает прослушивание клавиатуры (вызывается один раз при старте приложения). */
  listen(): void {
    fromEvent<KeyboardEvent>(this.document, 'keydown')
      .pipe(
        // Интересуют только сочетания с модификатором, чтобы не мешать вводу текста.
        filter((e) => e.ctrlKey || e.metaKey || e.altKey),
        map((e) => ({ event: e, hotkey: eventToHotkey(e) })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ event, hotkey }) => {
        const command = this.commands.commands().find((c) => c.hotkey === hotkey);
        if (command) {
          event.preventDefault();
          this.commands.run(command);
        }
      });
  }
}
