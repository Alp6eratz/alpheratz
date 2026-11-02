// Видеотека: отдельный раздел с видеоматериалами. Администратор добавляет/изменяет/удаляет видео,
// студенты только смотрят. Поиск и фильтр по категориям.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { LessonsFacade } from '@lingua/lessons/data-access';
import { VideoItem } from '@lingua/shared/models';
import { DialogService } from '@lingua/shared/ui';
import { VideoCardComponent } from './video-card.component';
import { VideoFormData, VideoFormDialog, VideoFormResult } from './video-form.dialog';

@Component({
  selector: 'lv-videos-page',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    VideoCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>Видеотека</h1>
          <p class="muted">Видеоуроки и дополнительные материалы от преподавателей.</p>
        </div>
        @if (facade.isAdmin()) {
          <button mat-flat-button (click)="add()">
            <mat-icon>video_call</mat-icon>Добавить видео
          </button>
        }
      </header>

      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
          <mat-icon matPrefix>search</mat-icon>
          <input
            matInput
            placeholder="Поиск видео"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </mat-form-field>
        @if (facade.videoCategories().length) {
          <mat-chip-listbox
            [value]="category()"
            (change)="category.set($event.value ?? '')"
            aria-label="Категория"
          >
            <mat-chip-option value="">Все</mat-chip-option>
            @for (c of facade.videoCategories(); track c) {
              <mat-chip-option [value]="c">{{ c }}</mat-chip-option>
            }
          </mat-chip-listbox>
        }
      </div>

      <div class="grid">
        @for (v of filtered(); track v.id) {
          <lv-video-card
            [video]="v"
            [admin]="facade.isAdmin()"
            (edit)="edit(v)"
            (remove)="remove(v)"
          />
        } @empty {
          <div class="empty">
            <mat-icon>video_library</mat-icon>
            @if (facade.videos().length) {
              <p>Ничего не найдено.</p>
            } @else if (facade.isAdmin()) {
              <p>
                Видеотека пуста. Нажмите «Добавить видео», чтобы загрузить файл или вставить ссылку
                на YouTube/Vimeo.
              </p>
            } @else {
              <p>Преподаватели ещё не добавили видео.</p>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 24px 64px;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
      h1 {
        margin: 0 0 4px;
      }
    }
    .muted {
      color: var(--lv-text-muted);
      margin: 0;
    }
    .filters {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin: 24px 0 20px;
    }
    .search {
      width: 280px;
      max-width: 100%;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .empty {
      grid-column: 1 / -1;
      text-align: center;
      padding: 48px 16px;
      color: var(--lv-text-faint);
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }
    }
    @media (max-width: 600px) {
      .page {
        padding: 20px 12px 48px;
      }
      .search {
        width: 100%;
      }
    }
  `,
})
export class VideosPageComponent {
  readonly facade = inject(LessonsFacade);
  private readonly dialog = inject(MatDialog);
  private readonly dialogs = inject(DialogService);

  readonly query = signal('');
  readonly category = signal('');

  /** Видео с учётом поиска и категории. */
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.facade
      .videos()
      .filter((v) => !this.category() || v.category === this.category())
      .filter((v) => !q || `${v.title} ${v.description} ${v.category}`.toLowerCase().includes(q));
  });

  add(): void {
    this.open({ categories: this.facade.videoCategories() }).subscribe((r) => {
      if (r)
        this.facade.addVideo(
          { title: r.title, description: r.description, category: r.category, url: r.url },
          r.file,
        );
    });
  }

  edit(video: VideoItem): void {
    this.open({ video, categories: this.facade.videoCategories() }).subscribe((r) => {
      if (r)
        this.facade.updateVideo(video.id, {
          title: r.title,
          description: r.description,
          category: r.category,
        });
    });
  }

  remove(video: VideoItem): void {
    this.dialogs
      .confirm({
        title: 'Удалить видео?',
        message: `«${video.title}» будет удалено из видеотеки.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .subscribe(() => this.facade.removeVideo(video));
  }

  private open(data: VideoFormData) {
    return this.dialog
      .open<VideoFormDialog, VideoFormData, VideoFormResult>(VideoFormDialog, {
        data,
        maxWidth: '96vw',
      })
      .afterClosed();
  }
}
