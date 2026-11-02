// Панель «Ссылки»: обратные ссылки (кто ссылается на заметку) и исходящие ссылки.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { VaultFacade } from '@lingua/core/data-access';

@Component({
  selector: 'lv-backlinks-view',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view-toolbar"><span class="view-title">Ссылки</span></div>
    @if (vault.activeNote(); as note) {
      <div class="section-title">Обратные ссылки · {{ vault.backlinks().length }}</div>
      @for (n of vault.backlinks(); track n.id) {
        <button class="link-row" (click)="vault.open(n.id)">
          <mat-icon>call_received</mat-icon>{{ n.title }}
        </button>
      } @empty {
        <div class="view-empty">Нет заметок, ссылающихся на «{{ note.title }}»</div>
      }
      <div class="section-title">Исходящие ссылки · {{ vault.outgoingLinks().length }}</div>
      @for (l of vault.outgoingLinks(); track l.title) {
        <button class="link-row" [class.unresolved]="!l.id" (click)="vault.openByTitle(l.title)">
          <mat-icon>{{ l.id ? 'call_made' : 'add_link' }}</mat-icon
          >{{ l.title }}
        </button>
      } @empty {
        <div class="view-empty">Исходящих ссылок нет</div>
      }
    } @else {
      <div class="view-empty">Откройте заметку, чтобы увидеть её связи.</div>
    }
  `,
  styleUrl: './views.scss',
})
export class BacklinksViewComponent {
  readonly vault = inject(VaultFacade);
}
