// Медиахранилище на IndexedDB: хранит загруженные файлы (видео, аудио, изображения, документы)
// как Blob. localStorage для этого не подходит из-за ограничения ~5 МБ.
import { Injectable } from '@angular/core';
import { createId } from '@lingua/shared/util';

/** Имя базы данных и хранилища объектов. */
const DB_NAME = 'lingua-vault-media';
const STORE = 'files';

/** Запись медиафайла в базе. */
interface MediaRecord {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  createdAt: string;
}

/** Метаданные сохранённого файла. */
export interface StoredMedia {
  mediaId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class MediaStore {
  /** Ленивое открытие базы (одно соединение на всё приложение). */
  private dbPromise: Promise<IDBDatabase> | null = null;
  /** Кэш object URL, чтобы не создавать их повторно. */
  private readonly urls = new Map<string, string>();

  /** Открывает (и при необходимости создаёт) базу данных. */
  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  /** Выполняет операцию в транзакции и возвращает её результат. */
  private async run<T>(
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.db();
    return new Promise<T>((resolve, reject) => {
      const request = op(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Сохраняет файл и возвращает его метаданные. */
  async save(file: File): Promise<StoredMedia> {
    const record: MediaRecord = {
      id: createId(),
      blob: file,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: new Date().toISOString(),
    };
    await this.run('readwrite', (s) => s.put(record));
    return { mediaId: record.id, fileName: record.name, mimeType: record.type, size: record.size };
  }

  /** Возвращает object URL для воспроизведения/скачивания файла или null, если файла нет. */
  async url(id: string): Promise<string | null> {
    const cached = this.urls.get(id);
    if (cached) return cached;
    const record = await this.run<MediaRecord | undefined>('readonly', (s) => s.get(id));
    if (!record) return null;
    const url = URL.createObjectURL(record.blob);
    this.urls.set(id, url);
    return url;
  }

  /** Удаляет файл. */
  async remove(id: string): Promise<void> {
    const url = this.urls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(id);
    await this.run('readwrite', (s) => s.delete(id));
  }
}

/** Человекочитаемый размер файла. */
export function formatFileSize(bytes = 0): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
