// Диалог добавления/редактирования видео в видеотеке (для администратора).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { formatFileSize } from '@lingua/core/data-access';
import { VideoItem } from '@lingua/shared/models';

/** Входные данные. */
export interface VideoFormData {
  video?: VideoItem;
  categories: string[];
}

/** Результат диалога. */
export interface VideoFormResult {
  title: string;
  description: string;
  category: string;
  url?: string;
  file: File | null;
}

@Component({
  selector: 'lv-video-form',
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.video ? 'Изменить видео' : 'Добавить видео' }}</h2>
    <mat-dialog-content class="content">
      <mat-form-field appearance="outline">
        <mat-label>Название</mat-label>
        <input matInput [ngModel]="title()" (ngModelChange)="title.set($event)" />
      </mat-form-field>

      @if (!data.video) {
        <mat-button-toggle-group
          class="source"
          [value]="source()"
          (change)="source.set($event.value)"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle value="url"><mat-icon>link</mat-icon> По ссылке</mat-button-toggle>
          <mat-button-toggle value="file"
            ><mat-icon>upload</mat-icon> Загрузить файл</mat-button-toggle
          >
        </mat-button-toggle-group>

        @if (source() === 'url') {
          <mat-form-field appearance="outline">
            <mat-label>Ссылка на YouTube, Vimeo или .mp4</mat-label>
            <input
              matInput
              type="url"
              placeholder="https://"
              [ngModel]="url()"
              (ngModelChange)="url.set($event)"
            />
          </mat-form-field>
        } @else {
          <div class="file">
            <button mat-stroked-button type="button" (click)="picker.click()">
              <mat-icon>video_file</mat-icon>Выбрать видеофайл
            </button>
            <input #picker type="file" accept="video/*" hidden (change)="pick(picker)" />
            <span class="muted">{{
              file() ? file()!.name + ' · ' + size() : 'Файл не выбран'
            }}</span>
          </div>
        }
      }

      <mat-form-field appearance="outline">
        <mat-label>Категория</mat-label>
        <input
          matInput
          [ngModel]="category()"
          (ngModelChange)="category.set($event)"
          [matAutocomplete]="auto"
          placeholder="Например: Грамматика"
        />
        <mat-autocomplete #auto="matAutocomplete">
          @for (c of categoryOptions(); track c) {
            <mat-option [value]="c">{{ c }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Описание</mat-label>
        <textarea
          matInput
          rows="3"
          [ngModel]="description()"
          (ngModelChange)="description.set($event)"
        ></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Отмена</button>
      <button mat-flat-button [disabled]="!valid()" (click)="save()">Сохранить</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      min-width: min(520px, 80vw);
      padding-top: 8px !important;
    }
    .source {
      align-self: flex-start;
      margin-bottom: 16px;
      mat-icon {
        vertical-align: middle;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
    .file {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .muted {
      color: var(--lv-text-muted);
      font-size: 0.9rem;
      word-break: break-all;
    }
  `,
})
export class VideoFormDialog {
  readonly data = inject<VideoFormData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<VideoFormDialog, VideoFormResult>);

  readonly title = signal(this.data.video?.title ?? '');
  readonly description = signal(this.data.video?.description ?? '');
  readonly category = signal(this.data.video?.category ?? '');
  readonly url = signal(this.data.video?.url ?? '');
  readonly source = signal<'url' | 'file'>('url');
  readonly file = signal<File | null>(null);
  /** Подсказки категорий, отфильтрованные по введённому тексту. */
  readonly categoryOptions = computed(() =>
    this.data.categories.filter((c) =>
      c.toLowerCase().includes(this.category().trim().toLowerCase()),
    ),
  );
  readonly size = computed(() => formatFileSize(this.file()?.size));

  readonly valid = computed(() => {
    if (!this.title().trim()) return false;
    if (this.data.video) return true;
    return this.source() === 'url' ? /^https?:\/\/\S+$/.test(this.url().trim()) : !!this.file();
  });

  pick(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    this.file.set(file);
    if (file && !this.title().trim()) this.title.set(file.name.replace(/\.\w+$/, ''));
  }

  save(): void {
    if (!this.valid()) return;
    this.ref.close({
      title: this.title().trim(),
      description: this.description().trim(),
      category: this.category().trim(),
      url: this.source() === 'url' ? this.url().trim() : undefined,
      file: this.source() === 'file' ? this.file() : null,
    });
  }
}
