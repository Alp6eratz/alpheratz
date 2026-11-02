// Разбор Markdown-текста: вики-ссылки, теги, заголовки, карточки «слово :: перевод».
import { NoteHeading } from '@lingua/shared/models';
import { slugify } from './id';

/** Регулярное выражение вики-ссылки: [[Заголовок]] или [[Заголовок|Подпись]]. */
export const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;

/** Регулярное выражение тега: #тег или #вложенный/тег (не внутри слова). */
export const TAG_RE = /(^|[\s(])#([\p{L}\p{N}_/-]+)/gu;

/** Регулярное выражение карточки: «лицевая :: оборотная» на отдельной строке. */
export const CARD_RE = /^\s*(?:[-*]\s+)?(.+?)\s+::\s+(.+?)\s*$/gm;

/** Удаляет блоки кода, чтобы не находить ссылки/теги внутри них. */
function stripCode(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

/** Возвращает уникальные заголовки заметок, на которые ссылается текст. */
export function extractWikiLinks(markdown: string): string[] {
  const result = new Set<string>();
  for (const match of stripCode(markdown).matchAll(WIKILINK_RE)) {
    result.add(match[1].trim());
  }
  return [...result];
}

/** Возвращает уникальные теги без символа #. */
export function extractTags(markdown: string): string[] {
  const result = new Set<string>();
  // Строки-заголовки «# Текст» не являются тегами: после # идёт пробел, regex их не захватит.
  for (const match of stripCode(markdown).matchAll(TAG_RE)) {
    const tag = match[2];
    // Чисто числовые «теги» (#1) Obsidian не считает тегами.
    if (!/^\d+$/.test(tag)) result.add(tag.toLowerCase());
  }
  return [...result];
}

/** Возвращает список заголовков для панели «Структура». */
export function extractHeadings(markdown: string): NoteHeading[] {
  const headings: NoteHeading[] = [];
  for (const line of stripCode(markdown).split('\n')) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      headings.push({ level: match[1].length, text: match[2], slug: slugify(match[2]) });
    }
  }
  return headings;
}

/** Возвращает пары «лицевая/оборотная» сторона из текста заметки. */
export function extractCardPairs(markdown: string): { front: string; back: string }[] {
  const pairs: { front: string; back: string }[] = [];
  for (const match of stripCode(markdown).matchAll(CARD_RE)) {
    pairs.push({ front: match[1].trim(), back: match[2].trim() });
  }
  return pairs;
}

/** Короткий фрагмент текста вокруг совпадения — для результатов поиска. */
export function snippetAround(text: string, query: string, radius = 40): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}
