// Озвучивание слов через Web Speech API — помогает запоминать произношение.
import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { settingsFeature } from '../settings/settings.feature';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private readonly store = inject(Store);
  /** Изучаемый язык из настроек. */
  private readonly language = this.store.selectSignal(settingsFeature.selectTargetLanguage);

  /** Поддерживает ли браузер синтез речи. */
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  /** Произносит текст на изучаемом (или указанном) языке. */
  speak(text: string, lang = this.language()): void {
    if (!this.supported || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    // Подбираем голос нужного языка, если он установлен в системе.
    const voice = synth
      .getVoices()
      .find((v) => v.lang.replace('_', '-').startsWith(lang.slice(0, 2)));
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  }
}
