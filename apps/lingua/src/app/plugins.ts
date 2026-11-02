// Список плагинов приложения. Чтобы добавить новую функцию, создайте плагин
// (см. libs/*/feature/src/lib/*.plugin.ts) и добавьте его в этот массив.
import { adminPlugin } from '@lingua/admin/feature';
import { LinguaPlugin } from '@lingua/core/plugin-api';
import { flashcardsPlugin } from '@lingua/flashcards/feature';
import { graphPlugin } from '@lingua/graph/feature';
import { lessonsPlugin, videosPlugin } from '@lingua/lessons/feature';
import { notesPlugin } from '@lingua/notes/feature';
import { settingsPlugin } from '@lingua/settings/feature';
import { corePlugin } from '@lingua/shell/feature';

export const APP_PLUGINS: LinguaPlugin[] = [
  corePlugin,
  notesPlugin,
  lessonsPlugin,
  videosPlugin,
  flashcardsPlugin,
  graphPlugin,
  adminPlugin,
  settingsPlugin,
];
