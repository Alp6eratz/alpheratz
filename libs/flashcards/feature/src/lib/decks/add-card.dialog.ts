// Диалог добавления карточки: слово, перевод и колода (тег) с автодополнением.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Входные данные: существующие колоды и колода по умолчанию. */
export interface AddCardData {
  decks: string[];
  deck?: string;
}

/** Результат: поля новой карточки. */
export interface AddCardResult {
  front: string;
  back: string;
  deck: string;
}

@Component({
  selector: 'lv-add-card',
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Новая карточка</h2>
    <form (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline">
          <mat-label>Слово или фраза (изучаемый язык)</mat-label>
          <input
            matInput
            name="front"
            [ngModel]="front()"
            (ngModelChange)="front.set($event)"
            cdkFocusInitial
            autocomplete="off"
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Перевод</mat-label>
          <input
            matInput
            name="back"
            [ngModel]="back()"
            (ngModelChange)="back.set($event)"
            autocomplete="off"
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Колода (тег)</mat-label>
          <input
            matInput
            name="deck"
            [ngModel]="deck()"
            (ngModelChange)="deck.set($event)"
            [matAutocomplete]="auto"
            placeholder="например: английский"
          />
          <mat-autocomplete #auto="matAutocomplete">
            @for (d of deckOptions(); track d) {
              <mat-option [value]="d">#{{ d }}</mat-option>
            }
          </mat-autocomplete>
          <mat-hint>Карточка сохранится в заметку «Карточки — колода»</mat-hint>
        </mat-form-field>
        @if (added()) {
          <p class="added">Добавлено карточек: {{ added() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" [mat-dialog-close]="added()">Готово</button>
        <button mat-stroked-button type="button" [disabled]="!valid()" (click)="save(true)">
          Добавить ещё
        </button>
        <button mat-flat-button type="submit" [disabled]="!valid()">Добавить</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      min-width: min(440px, 80vw);
      padding-top: 8px !important;
    }
    .added {
      margin: 8px 0 0;
      color: #3fb27f;
      font-size: 0.9rem;
    }
  `,
})
export class AddCardDialog {
  readonly data = inject<AddCardData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AddCardDialog, number>);
  /** Колбэк сохранения задаётся открывающей стороной. */
  onSave: (result: AddCardResult) => void = () => undefined;

  readonly front = signal('');
  readonly back = signal('');
  readonly deck = signal(this.data.deck ?? this.data.decks[0] ?? '');
  /** Сколько карточек добавлено за этот сеанс диалога. */
  readonly added = signal(0);
  /** Подсказки колод, отфильтрованные по введённому тексту. */
  readonly deckOptions = computed(() =>
    this.data.decks.filter((d) => d.includes(this.deck().trim().replace(/^#/, '').toLowerCase())),
  );
  readonly valid = computed(() => !!this.front().trim() && !!this.back().trim());

  /** Сохраняет карточку; `more` — оставить диалог открытым для следующей. */
  save(more = false): void {
    if (!this.valid()) return;
    this.onSave({ front: this.front(), back: this.back(), deck: this.deck() });
    this.added.update((n) => n + 1);
    if (more) {
      this.front.set('');
      this.back.set('');
    } else {
      this.ref.close(this.added());
    }
  }
}
