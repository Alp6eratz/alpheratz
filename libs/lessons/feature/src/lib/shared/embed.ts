// Распознавание видеохостингов и построение безопасных ссылок для встраивания (iframe).

/** Результат разбора ссылки на видео. */
export interface VideoEmbed {
  /** Тип: встраиваемый плеер хостинга или прямой файл. */
  kind: 'iframe' | 'file';
  /** Итоговый URL. */
  url: string;
  /** Обложка (для YouTube). */
  thumbnail?: string;
}

/** Разбирает ссылку YouTube / Vimeo / прямую ссылку на файл. */
export function parseVideoUrl(raw: string | undefined): VideoEmbed | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let youtubeId: string | null = null;
  if (host === 'youtu.be') youtubeId = url.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    youtubeId =
      url.searchParams.get('v') ??
      url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1] ??
      null;
  }
  if (youtubeId && /^[\w-]{6,}$/.test(youtubeId)) {
    return {
      kind: 'iframe',
      url: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }
  const vimeoId = host === 'vimeo.com' ? url.pathname.match(/^\/(\d+)/)?.[1] : null;
  if (vimeoId) return { kind: 'iframe', url: `https://player.vimeo.com/video/${vimeoId}` };
  return { kind: 'file', url: url.toString() };
}
