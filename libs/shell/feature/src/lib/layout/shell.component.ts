// Главный макет приложения в стиле Obsidian:
// лента | левая панель | вкладки + содержимое | правая панель, строка состояния снизу.
// На мобильных устройствах панели превращаются в выезжающие «ящики» (MatSidenav mode="over").
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthFacade } from '@lingua/auth/data-access';
import { UserMenuComponent } from '@lingua/auth/feature';
import { CommandService, HotkeyService } from '@lingua/core/plugin-api';
import {
  ThemeService,
  VaultFacade,
  WorkspaceActions,
  workspaceFeature,
} from '@lingua/core/data-access';
import { filter, map } from 'rxjs';
import { RibbonComponent } from './ribbon.component';
import { SidePanelComponent } from './side-panel.component';
import { StatusBarComponent } from './status-bar.component';
import { TabBarComponent } from './tab-bar.component';

/** Ключ localStorage для ширины левой панели. */
const WIDTH_KEY = 'lingua-vault:left-width';

@Component({
  selector: 'lv-shell',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    RibbonComponent,
    SidePanelComponent,
    TabBarComponent,
    StatusBarComponent,
    UserMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly commands = inject(CommandService);
  readonly vault = inject(VaultFacade);
  /** Текущий пользователь: без входа показываются только экраны авторизации. */
  readonly auth = inject(AuthFacade);

  /** true — узкий экран (телефон / маленький планшет). */
  readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 768px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  /** Состояние панелей на десктопе хранится в NgRx (и сохраняется между сессиями). */
  private readonly desktopLeft = this.store.selectSignal(workspaceFeature.selectLeftOpen);
  private readonly desktopRight = this.store.selectSignal(workspaceFeature.selectRightOpen);
  /** На мобильных панели по умолчанию закрыты — локальное состояние. */
  private readonly mobileLeft = signal(false);
  private readonly mobileRight = signal(false);

  readonly leftOpened = computed(() => (this.handset() ? this.mobileLeft() : this.desktopLeft()));
  readonly rightOpened = computed(() =>
    this.handset() ? this.mobileRight() : this.desktopRight(),
  );

  /** Ширина левой панели (изменяется перетаскиванием). */
  readonly leftWidth = signal(this.readWidth());

  constructor() {
    // Инициализация глобальных сервисов: темы и горячих клавиш.
    inject(ThemeService).init();
    inject(HotkeyService).listen();

    // При переходе на страницу, не являющуюся заметкой, снимаем «активную» заметку;
    // на мобильных закрываем панели после навигации.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((e) => {
        if (!e.urlAfterRedirects.startsWith('/note/'))
          this.store.dispatch(WorkspaceActions.leftNote());
        this.mobileLeft.set(false);
        this.mobileRight.set(false);
      });
  }

  /** Переключает левую панель. */
  toggleLeft(): void {
    if (this.handset()) this.mobileLeft.update((v) => !v);
    else this.store.dispatch(WorkspaceActions.toggleLeftPanel());
  }

  /** Переключает правую панель. */
  toggleRight(): void {
    if (this.handset()) this.mobileRight.update((v) => !v);
    else this.store.dispatch(WorkspaceActions.toggleRightPanel());
  }

  /** Синхронизация, когда ящик закрыт кликом по фону (мобильный режим). */
  onClosed(side: 'left' | 'right'): void {
    if (!this.handset()) return;
    (side === 'left' ? this.mobileLeft : this.mobileRight).set(false);
  }

  /** Открывает палитру команд. */
  openPalette(): void {
    this.commands.execute('core:command-palette');
  }

  /** Начало перетаскивания разделителя левой панели. */
  startResize(event: PointerEvent): void {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.leftWidth();
    const move = (e: PointerEvent) =>
      this.leftWidth.set(Math.min(520, Math.max(200, startWidth + e.clientX - startX)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        localStorage.setItem(WIDTH_KEY, String(this.leftWidth()));
      } catch {
        /* localStorage недоступен — ширина просто не запомнится */
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Читает сохранённую ширину панели. */
  private readWidth(): number {
    try {
      return Number(localStorage.getItem(WIDTH_KEY)) || 280;
    } catch {
      return 280;
    }
  }
}
