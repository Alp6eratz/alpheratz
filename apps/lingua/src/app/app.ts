// Корневой компонент: просто отображает оболочку приложения.
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShellComponent } from '@lingua/shell/feature';

@Component({
  selector: 'lv-root',
  imports: [ShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<lv-shell />`,
})
export class App {}
