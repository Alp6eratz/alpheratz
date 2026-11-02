// Диалог добавления/редактирования учебного материала (для администратора):
// текст в Markdown, видео/аудио/изображение/файл — загрузкой файла или по ссылке, внешняя ссылка.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { formatFileSize } from '@lingua/core/data-access';
import { LessonMaterial, MATERIAL_TYPES, MaterialType } from '@lingua/shared/models';

/** Входные данные: тип нового материала или существующий материал. */
export interface MaterialFormData {
  type?: MaterialType;
  material?: LessonMaterial;
}

/** Результат: материал без id и (необязательно) выбранный файл. */
export interface MaterialFormResult {
  material: Omit<LessonMaterial, 'id'>;
  file: File | null;
}

/** Допустимые типы файлов для поля загрузки. */
const ACCEPT: Partial<Record<MaterialType, string>> = {
  video: 'video/*',
  audio: 'audio/*',
  image: 'image/*',
  file: '*/*',
};

@Component({
  selector: 'lv-material-form',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.material ? 'Изменить материал' : 'Новый материал' }}</h2>
    <mat-dialog-content class="content">
      <mat-form-field appearance="outline">
        <mat-label>Тип</mat-label>
        <mat-select [value]="type()" (valueChange)="type.set($event)">
          @for (t of typeList; track t.key) {
            <mat-option [value]="t.key"
              ><mat-icon>{{ t.icon }}</mat-icon
              >{{ t.label }}</mat-option
            >
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Заголовок</mat-label>
        <input matInput [ngModel]="title()" (ngModelChange)="title.set($event)" required />
      </mat-form-field>

      @if (canUpload()) {
        <mat-button-toggle-group
          [value]="source()"
          (change)="source.set($event.value)"
          class="source"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle value="file"
            ><mat-icon>upload</mat-icon> Загрузить файл</mat-button-toggle
          >
          <mat-button-toggle value="url"><mat-icon>link</mat-icon> По ссылке</mat-button-toggle>
        </mat-button-toggle-group>
      }

      @if (needsUrl()) {
        <mat-form-field appearance="outline">
          <mat-label>{{
            type() === 'video' ? 'Ссылка (YouTube, Vimeo или .mp4)' : 'Ссылка'
          }}</mat-label>
          <input
            matInput
            type="url"
            [ngModel]="url()"
            (ngModelChange)="url.set($event)"
            placeholder="https://"
          />
        </mat-form-field>
      }

      @if (needsFile()) {
        <div class="file">
          <button mat-stroked-button type="button" (click)="picker.click()">
            <mat-icon>attach_file</mat-icon>Выбрать файл
          </button>
          <input #picker type="file" hidden [accept]="accept()" (change)="pick(picker)" />
          <span class="file-name">
            @if (file(); as f) {
              {{ f.name }} · {{ fileSize() }}
            } @else if (data.material?.fileName) {
              Текущий: {{ data.material?.fileName }}
            } @else {
              Файл не выбран
            }
          </span>
        </div>
        <p class="note">Файлы хранятся в браузере (IndexedDB) на этом устройстве.</p>
      }

      <mat-form-field appearance="outline">
        <mat-label>{{
          type() === 'text' ? 'Текст (Markdown)' : 'Описание (необязательно, Markdown)'
        }}</mat-label>
        <textarea
          matInput
          [rows]="type() === 'text' ? 12 : 3"
          [ngModel]="text()"
          (ngModelChange)="text.set($event)"
        ></textarea>
        @if (type() === 'text') {
          <mat-hint
            >Поддерживаются заголовки, таблицы, callout-блоки и карточки «слово ::
            перевод»</mat-hint
          >
        }
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
      gap: 4px;
      min-width: min(560px, 80vw);
      padding-top: 8px !important;
    }
    .source {
      margin-bottom: 16px;
      align-self: flex-start;
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
    }
    .file-name {
      color: var(--lv-text-muted);
      font-size: 0.9rem;
      word-break: break-all;
    }
    .note {
      font-size: 0.78rem;
      color: var(--lv-text-faint);
      margin: 6px 0 14px;
    }
    mat-option mat-icon {
      vertical-align: middle;
    }
  `,
})
export class MaterialFormDialog {
  readonly data = inject<MaterialFormData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<MaterialFormDialog, MaterialFormResult>);

  readonly typeList = Object.entries(MATERIAL_TYPES).map(([key, v]) => ({
    key: key as MaterialType,
    ...v,
  }));

  readonly type = signal<MaterialType>(this.data.material?.type ?? this.data.type ?? 'text');
  readonly title = signal(this.data.material?.title ?? '');
  readonly text = signal(this.data.material?.text ?? '');
  readonly url = signal(this.data.material?.url ?? '');
  /** Источник медиа: загруженный файл или ссылка. */
  readonly source = signal<'file' | 'url'>(this.data.material?.url ? 'url' : 'file');
  /** Новый выбранный файл. */
  readonly file = signal<File | null>(null);

  /** Для этого типа можно загрузить файл. */
  readonly canUpload = computed(() => !!ACCEPT[this.type()]);
  readonly needsFile = computed(() => this.canUpload() && this.source() === 'file');
  readonly needsUrl = computed(
    () => this.type() === 'link' || (this.canUpload() && this.source() === 'url'),
  );
  readonly accept = computed(() => ACCEPT[this.type()] ?? '*/*');
  readonly fileSize = computed(() => formatFileSize(this.file()?.size));

  /** Форма заполнена корректно. */
  readonly valid = computed(() => {
    if (!this.title().trim()) return false;
    if (this.type() === 'text') return !!this.text().trim();
    if (this.needsUrl()) return /^https?:\/\/\S+$/.test(this.url().trim());
    if (this.needsFile()) return !!this.file() || !!this.data.material?.mediaId;
    return true;
  });

  /** Выбор файла; заголовок подставляется из имени файла. */
  pick(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    this.file.set(file);
    if (file && !this.title().trim()) this.title.set(file.name.replace(/\.\w+$/, ''));
  }

  /** Закрывает диалог с результатом. */
  save(): void {
    if (!this.valid()) return;
    const existing = this.data.material;
    const useFile = this.needsFile();
    this.ref.close({
      material: {
        type: this.type(),
        title: this.title().trim(),
        text: this.text().trim() || undefined,
        url: this.needsUrl() ? this.url().trim() : undefined,
        // Если файл не перевыбран — сохраняем ссылку на прежний.
        mediaId: useFile && !this.file() ? existing?.mediaId : undefined,
        fileName: useFile && !this.file() ? existing?.fileName : undefined,
        mimeType: useFile && !this.file() ? existing?.mimeType : undefined,
        size: useFile && !this.file() ? existing?.size : undefined,
      },
      file: useFile ? this.file() : null,
    });
  }
}
