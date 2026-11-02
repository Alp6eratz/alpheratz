// Встроенные расширения синтаксиса Markdown в стиле Obsidian (для библиотеки marked):
// [[вики-ссылки]], #теги, ==выделение== и callout-блоки `> [!note]`.
import { MarkedExtension, Tokens } from 'marked';

/** Контекст рендеринга — позволяет расширениям узнать, существует ли заметка. */
export interface RenderContext {
  /** Возвращает id заметки по заголовку или null. */
  resolveTitle: (title: string) => string | null;
}

/** Экранирование HTML-спецсимволов. */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** Текущий контекст рендеринга (marked работает синхронно, поэтому это безопасно). */
let currentContext: RenderContext = { resolveTitle: () => null };

/** Устанавливает контекст перед рендерингом. */
export function setRenderContext(context: RenderContext): void {
  currentContext = context;
}

/** Токен вики-ссылки. */
interface WikiLinkToken extends Tokens.Generic {
  target: string;
  label: string;
}

/** [[Заголовок]] / [[Заголовок|Подпись]] → ссылка; несуществующие заметки подсвечиваются. */
export const wikiLinkExtension: MarkedExtension = {
  extensions: [
    {
      name: 'wikilink',
      level: 'inline',
      start: (src) => src.indexOf('[['),
      tokenizer(src) {
        const match = /^\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/.exec(src);
        if (!match) return undefined;
        return {
          type: 'wikilink',
          raw: match[0],
          target: match[1].trim(),
          label: (match[3] ?? match[1]).trim(),
        };
      },
      renderer(token) {
        const { target, label } = token as WikiLinkToken;
        const exists = currentContext.resolveTitle(target) !== null;
        return `<a class="lv-wikilink${exists ? '' : ' lv-unresolved'}" data-wikilink="${escapeHtml(target)}" href="#">${escapeHtml(label)}</a>`;
      },
    },
  ],
};

/** #тег → кликабельная метка (запускает поиск по тегу). */
export const tagExtension: MarkedExtension = {
  extensions: [
    {
      name: 'tag',
      level: 'inline',
      // Тег начинается с # после пробела или в начале строки.
      start(src) {
        const match = /(^|\s)#[\p{L}_]/u.exec(src);
        return match ? match.index + match[1].length : undefined;
      },
      tokenizer(src) {
        const match = /^#([\p{L}_][\p{L}\p{N}_/-]*)/u.exec(src);
        if (!match) return undefined;
        return { type: 'tag', raw: match[0], text: match[1] };
      },
      renderer(token) {
        const tag = escapeHtml(String(token['text']).toLowerCase());
        return `<a class="lv-tag" data-tag="${tag}" href="#">#${escapeHtml(String(token['text']))}</a>`;
      },
    },
  ],
};

/** ==текст== → <mark>. */
export const highlightExtension: MarkedExtension = {
  extensions: [
    {
      name: 'highlight',
      level: 'inline',
      start: (src) => src.indexOf('=='),
      tokenizer(src) {
        const match = /^==([^=\n]+)==/.exec(src);
        if (!match) return undefined;
        return { type: 'highlight', raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
      },
      renderer(token) {
        return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`;
      },
    },
  ],
};

/** Иконки callout-блоков по типу. */
const CALLOUT_ICONS: Record<string, string> = {
  note: 'edit_note',
  tip: 'lightbulb',
  info: 'info',
  warning: 'warning',
  danger: 'error',
  example: 'format_quote',
  question: 'help',
  success: 'check_circle',
};

/** Callout: `> [!tip] Заголовок` → оформленный блок, как в Obsidian. */
export const calloutExtension: MarkedExtension = {
  renderer: {
    blockquote({ tokens }) {
      const body = this.parser.parse(tokens);
      const match = /^<p>\[!(\w+)\][ \t]*([^\n<]*)\n?/.exec(body);
      if (!match) return `<blockquote>${body}</blockquote>`;
      const type = match[1].toLowerCase();
      const title = match[2].trim() || type.charAt(0).toUpperCase() + type.slice(1);
      const rest = '<p>' + body.slice(match[0].length);
      const content = rest.replace(/^<p><\/p>\n?/, '');
      return `<div class="lv-callout lv-callout-${escapeHtml(type)}"><div class="lv-callout-title"><span class="material-symbols-outlined">${CALLOUT_ICONS[type] ?? 'info'}</span>${escapeHtml(title)}</div><div class="lv-callout-content">${content}</div></div>`;
    },
  },
};

/** Список встроенных расширений ядра. */
export const CORE_MARKDOWN_EXTENSIONS: MarkedExtension[] = [
  wikiLinkExtension,
  tagExtension,
  highlightExtension,
  calloutExtension,
];
