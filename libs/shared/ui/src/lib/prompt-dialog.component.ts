// Диалог ввода строки (имя заметки, папки и т.п.) на основе MatDialog.
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Входные данные диалога. */
export interface PromptDialogData {
  title: string;
  label: string;
  value?: string;
  confirmText?: string;
  hint?: string;
}

@Component({
  selector: 'lv-prompt-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form (ngSubmit)="submit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ data.label }}</mat-label>
          <input
            matInput
            name="value"
            [ngModel]="value()"
            (ngModelChange)="value.set($event)"
            cdkFocusInitial
            autocomplete="off"
          />
          @if (data.hint) {
            <mat-hint>{{ data.hint }}</mat-hint>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Отмена</button>
        <button mat-flat-button type="submit" [disabled]="!value().trim()">
          {{ data.confirmText ?? 'OK' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .full {
      width: 100%;
      min-width: min(360px, 70vw);
      margin-top: 8px;
    }
  `,
})
export class PromptDialogComponent {
  /** Данные, переданные при открытии. */
  readonly data = inject<PromptDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PromptDialogComponent, string>);
  /** Текущее значение поля. */
  readonly value = signal(this.data.value ?? '');

  /** Закрывает диалог с введённым значением. */
  submit(): void {
    if (this.value().trim()) this.ref.close(this.value().trim());
  }
}
