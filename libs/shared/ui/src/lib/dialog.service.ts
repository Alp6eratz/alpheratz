// Сервис-обёртка над MatDialog: открывает типовые диалоги и возвращает Observable с результатом.
import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { filter, map, Observable } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';
import { PromptDialogComponent, PromptDialogData } from './prompt-dialog.component';

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(MatDialog);

  /** Запрашивает строку. Эмитит значение только при подтверждении. */
  prompt(data: PromptDialogData): Observable<string> {
    return this.dialog
      .open<PromptDialogComponent, PromptDialogData, string>(PromptDialogComponent, { data })
      .afterClosed()
      .pipe(filter((v): v is string => !!v));
  }

  /** Запрашивает подтверждение. Эмитит только при согласии пользователя. */
  confirm(data: ConfirmDialogData): Observable<true> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { data })
      .afterClosed()
      .pipe(
        filter((v) => v === true),
        map(() => true as const),
      );
  }
}
