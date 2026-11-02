// Получение URL загруженного файла из медиахранилища в виде сигнала.
import { DestroyRef, inject, signal, Signal } from '@angular/core';
import { MediaStore } from '@lingua/core/data-access';

/**
 * Возвращает сигнал с object URL для mediaId (null — пока загружается или файла нет).
 * Вызывать в контексте внедрения зависимостей (конструктор / инициализатор поля).
 */
export function mediaUrl(mediaId: () => string | undefined): {
  url: Signal<string | null>;
  refresh: () => void;
} {
  const store = inject(MediaStore);
  const url = signal<string | null>(null);
  let alive = true;
  inject(DestroyRef).onDestroy(() => (alive = false));
  const refresh = () => {
    const id = mediaId();
    url.set(null);
    if (id) store.url(id).then((u) => alive && url.set(u));
  };
  return { url, refresh };
}
