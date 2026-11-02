// Панель вкладок открытых заметок + переключатель режима (редактирование / просмотр / раздельный).
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VaultFacade, WorkspaceActions } from '@lingua/core/data-access';
import { EditorMode } from '@lingua/shared/models';

@Component({
  selector: 'lv-tab-bar',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist">
      @for (tab of vault.tabs(); track tab.noteId) {
        <div
          class="tab"
          role="tab"
          [class.active]="tab.noteId === vault.activeNote()?.id"
          [attr.aria-selected]="tab.noteId === vault.activeNote()?.id"
          (click)="vault.open(tab.noteId)"
          (auxclick)="$event.button === 1 && close(tab.noteId)"
        >
          <span class="title">{{ tab.note.title }}</span>
          <button
            class="close"
            (click)="$event.stopPropagation(); close(tab.noteId)"
            aria-label="Закрыть вкладку"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
      <button
        mat-icon-button
        class="new"
        matTooltip="Новая заметка"
        (click)="vault.createNote({ title: 'Без названия', folder: '' })"
      >
        <mat-icon>add</mat-icon>
      </button>
    </div>
    @if (vault.activeNote(); as note) {
      <mat-button-toggle-group
        class="modes"
        hideSingleSelectionIndicator
        [value]="vault.activeMode()"
        (change)="setMode(note.id, $event.value)"
        aria-label="Режим отображения"
      >
        <mat-button-toggle value="edit" matTooltip="Редактирование"
          ><mat-icon>edit</mat-icon></mat-button-toggle
        >
        <mat-button-toggle value="split" matTooltip="Раздельный режим" class="hide-mobile"
          ><mat-icon>vertical_split</mat-icon></mat-button-toggle
        >
        <mat-button-toggle value="preview" matTooltip="Просмотр"
          ><mat-icon>visibility</mat-icon></mat-button-toggle
        >
      </mat-button-toggle-group>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: var(--lv-bg-secondary);
      border-bottom: 1px solid var(--lv-border);
      padding: 6px 8px 0;
      min-height: 42px;
    }
    .tabs {
      flex: 1;
      display: flex;
      align-items: flex-end;
      gap: 2px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tab {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 220px;
      min-width: 90px;
      height: 34px;
      padding: 0 6px 0 12px;
      border-radius: 8px 8px 0 0;
      color: var(--lv-text-muted);
      cursor: pointer;
      font-size: 0.86rem;
      flex-shrink: 0;
      &:hover {
        background: var(--lv-hover);
      }
      &.active {
        background: var(--lv-bg);
        color: var(--lv-text);
      }
      .title {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .close {
        border: none;
        background: transparent;
        color: inherit;
        border-radius: 4px;
        cursor: pointer;
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        padding: 0;
        opacity: 0.6;
      }
      .close:hover {
        background: var(--lv-hover);
        opacity: 1;
      }
      .close mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }
    .new {
      --mat-icon-button-state-layer-size: 30px;
      padding: 3px;
      margin-bottom: 2px;
      color: var(--lv-text-muted);
      flex-shrink: 0;
    }
    .modes {
      margin-bottom: 4px;
      --mat-button-toggle-height: 30px;
      flex-shrink: 0;
      border-radius: 8px;
    }
    .modes mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      vertical-align: middle;
    }
    @media (max-width: 768px) {
      .hide-mobile {
        display: none;
      }
    }
  `,
})
export class TabBarComponent {
  readonly vault = inject(VaultFacade);
  private readonly store = inject(Store);

  /** Закрывает вкладку. */
  close(noteId: string): void {
    this.store.dispatch(WorkspaceActions.closeTab({ noteId }));
  }

  /** Закрывает все вкладки, кроме выбранной. */
  closeOthers(noteId: string): void {
    this.store.dispatch(WorkspaceActions.closeOtherTabs({ noteId }));
    this.vault.open(noteId);
  }

  /** Меняет режим отображения вкладки. */
  setMode(noteId: string, mode: EditorMode): void {
    this.store.dispatch(WorkspaceActions.setMode({ noteId, mode }));
  }
}
