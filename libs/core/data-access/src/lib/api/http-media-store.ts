// Медиахранилище на сервере: файлы загружаются в бэкенд (POST /api/media),
// а для воспроизведения используется ссылка с токеном в параметре.
import { inject, Injectable } from '@angular/core';
import { MediaStore, StoredMedia } from '../storage/media-store';
import { ApiClient } from './api-client';

@Injectable()
export class HttpMediaStore extends MediaStore {
  private readonly api = inject(ApiClient);

  /** Загружает файл на сервер. */
  override async save(file: File): Promise<StoredMedia> {
    return this.api.upload<StoredMedia>('/api/media', file);
  }

  /** Адрес файла на сервере (с токеном — теги <video>/<audio>/<img> не передают заголовки). */
  override async url(id: string): Promise<string | null> {
    return this.api.fileUrl(`/api/media/${encodeURIComponent(id)}`);
  }

  /** Удаляет файл на сервере. */
  override async remove(id: string): Promise<void> {
    await this.api.delete(`/api/media/${encodeURIComponent(id)}`);
  }
}
