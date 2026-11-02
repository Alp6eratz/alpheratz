// Расширение Markdown плагина карточек: строка «слово :: перевод» отображается
// как карточка с кнопкой озвучивания. При отключении плагина строки показываются как обычный текст.
import { MarkedExtension } from 'marked';

/** Строка-карточка: «лицевая :: оборотная». */
const CARD_LINE = /^([^\n]+?) :: ([^\n]+?)[ \t]*(?:\n|$)/;

/**
 * Проверяет, что строка — действительно карточка: не заголовок/таблица/цитата/список
 * и разделитель «::» не находится внутри `inline-кода`.
 */
function isCardLine(front: string): boolean {
  if (/^\s*(#|\||>|[-*+]\s|\d+\.\s)/.test(front)) return false;
  return (front.match(/`/g) ?? []).length % 2 === 0;
}

/** Ищет позицию первой строки-карточки в тексте (для подсказки `start`). */
function findCardStart(src: string): number | undefined {
  let offset = 0;
  for (const line of src.split('\n')) {
    const match = CARD_LINE.exec(line);
    if (match && isCardLine(match[1])) return offset;
    offset += line.length + 1;
  }
  return undefined;
}

/** Экранирование значения HTML-атрибута. */
const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const flashcardMarkdownExtension: MarkedExtension = {
  extensions: [
    {
      name: 'flashcard',
      level: 'block',
      // Подсказка marked, где может начинаться карточка.
      start: findCardStart,
      tokenizer(src) {
        const match = CARD_LINE.exec(src);
        // Элементы списков верхнего уровня не перехватываем: внутри элемента списка
        // префикс «- » уже снят, и карточка распознаётся там.
        if (!match || !isCardLine(match[1])) return undefined;
        return {
          type: 'flashcard',
          raw: match[0],
          front: match[1].trim(),
          back: match[2].trim(),
          frontTokens: this.lexer.inlineTokens(match[1].trim()),
          backTokens: this.lexer.inlineTokens(match[2].trim()),
        };
      },
      renderer(token) {
        const front = this.parser.parseInline(token['frontTokens']);
        const back = this.parser.parseInline(token['backTokens']);
        return (
          `<div class="lv-flashcard">` +
          `<button class="lv-speak" data-speak="${attr(String(token['front']))}" title="Произнести" aria-label="Произнести">` +
          `<span class="material-symbols-outlined">volume_up</span></button>` +
          `<span class="lv-front">${front}</span><span class="lv-sep">→</span><span class="lv-back">${back}</span></div>\n`
        );
      },
    },
  ],
};
