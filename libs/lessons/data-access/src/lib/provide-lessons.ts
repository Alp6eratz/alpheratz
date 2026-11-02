// Подключение NgRx-состояния уроков (вызывается из провайдеров плагина «Уроки»).
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { lessonsEffects } from './lessons.effects';
import { lessonsFeature } from './lessons.feature';

export function provideLessonsState() {
  return [provideState(lessonsFeature), provideEffects(lessonsEffects)];
}
