// Реестр плагинов: собирает вклад всех включённых плагинов в виде реактивных сигналов.
import { computed, inject, Injectable } from '@angular/core';
import { MarkedExtension } from 'marked';
import {
  LinguaPlugin,
  PluginCommand,
  RibbonItem,
  SidebarView,
  StatusBarItem,
} from './plugin.model';
import { DISABLED_PLUGINS, LINGUA_PLUGINS } from './plugin.tokens';

/** Сортировка по полю `order`. */
const byOrder = <T extends { order?: number }>(a: T, b: T) => (a.order ?? 100) - (b.order ?? 100);

@Injectable({ providedIn: 'root' })
export class PluginRegistry {
  /** Все зарегистрированные плагины (включая отключённые). */
  readonly all: readonly LinguaPlugin[] = inject(LINGUA_PLUGINS, { optional: true }) ?? [];

  /** Сигнал отключённых плагинов. */
  private readonly disabled = inject(DISABLED_PLUGINS);

  /** Только включённые плагины. Системные (core) включены всегда. */
  readonly enabled = computed(() => {
    const disabled = new Set(this.disabled());
    return this.all.filter((p) => p.core || !disabled.has(p.id));
  });

  /** Все команды включённых плагинов. */
  readonly commands = computed<PluginCommand[]>(() =>
    this.enabled().flatMap((p) => p.commands ?? []),
  );

  /** Кнопки ленты, отсортированные по порядку. */
  readonly ribbon = computed<RibbonItem[]>(() =>
    this.enabled()
      .flatMap((p) => p.ribbon ?? [])
      .sort(byOrder),
  );

  /** Виды левой панели. */
  readonly leftViews = computed<SidebarView[]>(() => this.views('left'));

  /** Виды правой панели. */
  readonly rightViews = computed<SidebarView[]>(() => this.views('right'));

  /** Элементы строки состояния. */
  readonly statusBar = computed<StatusBarItem[]>(() =>
    this.enabled()
      .flatMap((p) => p.statusBar ?? [])
      .sort(byOrder),
  );

  /** Расширения Markdown всех включённых плагинов. */
  readonly markdownExtensions = computed<MarkedExtension[]>(() =>
    this.enabled().flatMap((p) => p.markdownExtensions ?? []),
  );

  /** Проверяет, включён ли плагин. */
  isEnabled(pluginId: string): boolean {
    return this.enabled().some((p) => p.id === pluginId);
  }

  /** Виды панели заданной стороны. */
  private views(side: 'left' | 'right'): SidebarView[] {
    return this.enabled()
      .flatMap((p) => p.sidebarViews ?? [])
      .filter((v) => v.side === side)
      .sort(byOrder);
  }
}
