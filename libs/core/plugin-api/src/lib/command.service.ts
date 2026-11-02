// Сервис команд: поиск и выполнение команд плагинов в контексте внедрения зависимостей.
import { EnvironmentInjector, inject, Injectable, runInInjectionContext } from '@angular/core';
import { PluginCommand } from './plugin.model';
import { PluginRegistry } from './plugin-registry.service';

@Injectable({ providedIn: 'root' })
export class CommandService {
  private readonly registry = inject(PluginRegistry);
  private readonly injector = inject(EnvironmentInjector);

  /** Сигнал со списком доступных команд. */
  readonly commands = this.registry.commands;

  /** Выполняет команду по id. Возвращает false, если команда не найдена. */
  execute(commandId: string): boolean {
    const command = this.commands().find((c) => c.id === commandId);
    if (!command) return false;
    this.run(command);
    return true;
  }

  /** Выполняет переданную команду. */
  run(command: PluginCommand): void {
    runInInjectionContext(this.injector, () => command.run());
  }

  /** Нечёткий поиск команд по строке (все слова запроса должны встречаться в названии). */
  search(query: string): PluginCommand[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.commands()
      .filter((c) => words.every((w) => c.name.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }
}
