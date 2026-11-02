// Плагин «Карточки»: интервальное повторение слов из заметок (SM-2).
// Демонстрирует все точки расширения: маршруты, NgRx-состояние, команды, ленту, строку состояния и Markdown.
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { definePlugin } from '@lingua/core/plugin-api';
import { VaultFacade } from '@lingua/core/data-access';
import { flashcardMarkdownExtension } from './card.extension';
import { flashcardsEffects } from './state/flashcards.effects';
import { flashcardsFeature } from './state/flashcards.feature';
import { DueBadgeComponent } from './status/due-badge.component';

export const flashcardsPlugin = definePlugin({
  id: 'flashcards',
  name: 'Карточки',
  description:
    'Интервальное повторение слов: строки «слово :: перевод» превращаются в карточки (алгоритм SM-2).',
  version: '1.0.0',
  icon: 'style',

  providers: [provideState(flashcardsFeature), provideEffects(flashcardsEffects)],

  routes: [
    {
      path: 'flashcards',
      title: 'Карточки · LinguaVault',
      loadComponent: () => import('./decks/decks.component').then((m) => m.DecksComponent),
    },
    {
      path: 'flashcards/review',
      title: 'Повторение · LinguaVault',
      loadComponent: () => import('./review/review.component').then((m) => m.ReviewComponent),
    },
  ],

  ribbon: [
    {
      id: 'flashcards:ribbon',
      icon: 'style',
      tooltip: 'Карточки',
      route: '/flashcards',
      order: 10,
    },
  ],

  commands: [
    {
      id: 'flashcards:open',
      name: 'Карточки: открыть колоды',
      icon: 'style',
      run: () => inject(Router).navigateByUrl('/flashcards'),
    },
    {
      id: 'flashcards:review',
      name: 'Карточки: начать повторение',
      icon: 'play_arrow',
      hotkey: 'Alt+R',
      run: () => inject(Router).navigate(['/flashcards/review'], { queryParams: { deck: 'all' } }),
    },
    {
      id: 'flashcards:review-note',
      name: 'Карточки: повторить теги текущей заметки',
      icon: 'sell',
      run: () => {
        const vault = inject(VaultFacade);
        const tag = vault.activeMeta()?.tags[0];
        inject(Router).navigate(['/flashcards/review'], { queryParams: { deck: tag ?? 'all' } });
      },
    },
  ],

  statusBar: [{ id: 'flashcards:due', component: DueBadgeComponent, order: 1 }],

  markdownExtensions: [flashcardMarkdownExtension],
});
