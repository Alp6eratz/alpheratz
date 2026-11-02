// Панель поиска: полнотекстовый поиск по заметкам с подсветкой фрагментов (RxJS debounce).
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { VaultFacade } from '@lingua/core/data-access';
import { combineLatest, debounceTime, distinctUntilChanged, map } from 'rxjs';

@Component({
  selector: 'lv-search-view',
  imports: [MatFormFieldModule, MatInputModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view-toolbar"><span class="view-title">Поиск</span></div>
    <div class="view-pad">
      <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
        <mat-icon matPrefix>search</mat-icon>
        <input
          matInput
          placeholder="Текст или tag:#тег"
          [value]="vault.searchQuery()"
          (input)="vault.search($any($event.target).value)"
        />
      </mat-form-field>
    </div>
    @if (vault.searchQuery()) {
      <div class="view-meta">Найдено: {{ results().length }}</div>
    }
    @for (r of results(); track r.note.id) {
      <button class="search-result" (click)="vault.open(r.note.id)">
        <span class="title">{{ r.note.title }}</span>
        <span class="snippet">{{ r.snippet }}</span>
      </button>
    }
  `,
  styleUrl: './views.scss',
})
export class SearchViewComponent {
  readonly vault = inject(VaultFacade);

  /** Результаты: пересчитываются с задержкой 200 мс после ввода и при изменении заметок. */
  readonly results = toSignal(
    combineLatest([
      toObservable(this.vault.searchQuery).pipe(debounceTime(200), distinctUntilChanged()),
      toObservable(this.vault.notes),
    ]).pipe(map(([query]) => this.vault.find(query))),
    { initialValue: [] },
  );
}
