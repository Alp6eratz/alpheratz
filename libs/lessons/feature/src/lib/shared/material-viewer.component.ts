// Отображение одного учебного материала: текст (Markdown), видео, аудио, изображение, файл или ссылка.
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { formatFileSize } from '@lingua/core/data-access';
import { MarkdownService } from '@lingua/core/markdown';
import { LessonMaterial, MATERIAL_TYPES } from '@lingua/shared/models';
import { MarkdownPreviewComponent } from '@lingua/notes/feature';
import { parseVideoUrl } from './embed';
import { mediaUrl } from './media-url';

@Component({
  selector: 'lv-material-viewer',
  imports: [MatButtonModule, MatIconModule, MarkdownPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = material();
    <header class="head">
      <mat-icon>{{ types[m.type].icon }}</mat-icon>
      <h3>{{ m.title }}</h3>
    </header>

    @switch (m.type) {
      @case ('text') {
        <lv-markdown-preview [content]="m.text ?? ''" />
      }
      @case ('video') {
        @if (embed(); as e) {
          @if (e.kind === 'iframe') {
            <div class="frame">
              <iframe
                [src]="safeEmbed()"
                title="{{ m.title }}"
                allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
                allowfullscreen
              ></iframe>
            </div>
          } @else {
            <video class="player" controls preload="metadata" [src]="e.url"></video>
          }
        } @else if (media.url(); as src) {
          <video class="player" controls preload="metadata" [src]="src"></video>
        } @else {
          <div class="missing">Видео недоступно</div>
        }
      }
      @case ('audio') {
        @if (source(); as src) {
          <audio class="audio" controls preload="metadata" [src]="src"></audio>
        } @else {
          <div class="missing">Аудио недоступно</div>
        }
      }
      @case ('image') {
        @if (source(); as src) {
          <img class="image" [src]="src" [alt]="m.title" loading="lazy" />
        }
      }
      @case ('file') {
        @if (source(); as src) {
          <a
            mat-stroked-button
            class="download"
            [href]="src"
            [attr.download]="m.fileName ?? m.title"
            target="_blank"
            rel="noopener"
          >
            <mat-icon>download</mat-icon>{{ m.fileName ?? 'Скачать файл' }}
            @if (m.size) {
              <span class="size">{{ size() }}</span>
            }
          </a>
        }
      }
      @case ('link') {
        <a mat-stroked-button [href]="m.url" target="_blank" rel="noopener noreferrer"
          ><mat-icon>open_in_new</mat-icon>{{ m.url }}</a
        >
      }
    }

    @if (m.type !== 'text' && m.text) {
      <div class="description"><lv-markdown-preview [content]="m.text" /></div>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 20px;
      border-radius: 12px;
      background: var(--lv-bg-secondary);
      border: 1px solid var(--lv-border);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      mat-icon {
        color: var(--lv-accent);
      }
      h3 {
        margin: 0;
        font-size: 1.1rem;
      }
    }
    .frame {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: 10px;
      overflow: hidden;
      background: #000;
      iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
      }
    }
    .player {
      width: 100%;
      max-height: 70vh;
      border-radius: 10px;
      background: #000;
    }
    .audio {
      width: 100%;
    }
    .image {
      max-width: 100%;
      border-radius: 10px;
      display: block;
    }
    .download .size {
      margin-left: 8px;
      opacity: 0.7;
      font-size: 0.85em;
    }
    .missing {
      padding: 24px;
      text-align: center;
      color: var(--lv-text-faint);
      background: var(--lv-hover);
      border-radius: 10px;
    }
    .description {
      margin-top: 12px;
      color: var(--lv-text-muted);
    }
    a[mat-stroked-button] {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class MaterialViewerComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly markdown = inject(MarkdownService);
  readonly types = MATERIAL_TYPES;

  /** Отображаемый материал. */
  readonly material = input.required<LessonMaterial>();

  /** URL загруженного файла (если материал хранится локально). */
  readonly media = mediaUrl(() => this.material().mediaId);
  /** Разобранная ссылка на видео. */
  readonly embed = computed(() =>
    this.material().mediaId ? null : parseVideoUrl(this.material().url),
  );
  /** URL плеера хостинга — доверяем только распознанным YouTube/Vimeo. */
  readonly safeEmbed = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.embed()?.url ?? ''),
  );
  /** Источник: загруженный файл или внешняя ссылка. */
  readonly source = computed(() => this.media.url() ?? this.material().url ?? null);
  readonly size = computed(() => formatFileSize(this.material().size));

  constructor() {
    // Перезагружаем URL файла при смене материала.
    effect(() => {
      this.material().mediaId;
      this.media.refresh();
    });
  }
}
