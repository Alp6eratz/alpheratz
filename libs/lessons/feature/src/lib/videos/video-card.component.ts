// Карточка видео в видеотеке: обложка (для YouTube) или плеер после нажатия.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { VideoItem } from '@lingua/shared/models';
import { parseVideoUrl } from '../shared/embed';
import { mediaUrl } from '../shared/media-url';

@Component({
  selector: 'lv-video-card',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = video();
    <div class="screen">
      @if (playing()) {
        @if (embed()?.kind === 'iframe') {
          <iframe
            [src]="safeEmbed()"
            [title]="v.title"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowfullscreen
          ></iframe>
        } @else {
          <video controls autoplay [src]="embed()?.url ?? media.url() ?? ''"></video>
        }
      } @else {
        <button
          class="cover"
          (click)="playing.set(true)"
          [attr.aria-label]="'Смотреть: ' + v.title"
        >
          @if (embed()?.thumbnail; as thumb) {
            <img [src]="thumb" alt="" loading="lazy" />
          }
          <span class="play"><mat-icon>play_arrow</mat-icon></span>
        </button>
      }
    </div>
    <div class="info">
      <div class="title-row">
        <h3>{{ v.title }}</h3>
        @if (admin()) {
          <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="Действия">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #menu="matMenu">
            <button mat-menu-item (click)="edit.emit()"><mat-icon>edit</mat-icon>Изменить</button>
            <button mat-menu-item (click)="remove.emit()">
              <mat-icon>delete</mat-icon>Удалить
            </button>
          </mat-menu>
        }
      </div>
      <div class="meta">
        @if (v.category) {
          <span class="category">{{ v.category }}</span>
        }
        <span>{{ v.createdAt | date: 'd MMM y' }}</span>
      </div>
      @if (v.description) {
        <p class="desc">{{ v.description }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      overflow: hidden;
      background: var(--lv-bg-secondary);
      border: 1px solid var(--lv-border);
    }
    .screen {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #000;
      iframe,
      video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
      }
    }
    .cover {
      position: absolute;
      inset: 0;
      width: 100%;
      border: 0;
      padding: 0;
      cursor: pointer;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, color-mix(in srgb, var(--lv-accent) 45%, #000), #111);
      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.85;
      }
    }
    .play {
      position: relative;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      mat-icon {
        font-size: 34px;
        width: 34px;
        height: 34px;
      }
    }
    .cover:hover .play {
      background: var(--lv-accent);
    }
    .info {
      padding: 12px 14px 14px;
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      h3 {
        margin: 4px 0 0;
        font-size: 1rem;
      }
    }
    .meta {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 6px;
      font-size: 0.78rem;
      color: var(--lv-text-faint);
    }
    .category {
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--lv-active);
      color: var(--lv-accent);
    }
    .desc {
      margin: 8px 0 0;
      font-size: 0.88rem;
      color: var(--lv-text-muted);
    }
  `,
})
export class VideoCardComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly video = input.required<VideoItem>();
  /** Показывать ли меню администратора. */
  readonly admin = input(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  /** Воспроизводится ли видео (плеер создаётся только по нажатию). */
  readonly playing = signal(false);
  readonly media = mediaUrl(() => this.video().mediaId);
  readonly embed = computed(() => parseVideoUrl(this.video().url));
  readonly safeEmbed = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`${this.embed()?.url ?? ''}?autoplay=1`),
  );

  constructor() {
    effect(() => {
      this.video().mediaId;
      this.media.refresh();
    });
  }
}
