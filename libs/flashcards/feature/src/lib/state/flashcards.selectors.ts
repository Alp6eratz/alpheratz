// Селекторы карточек: извлечение карточек из всех заметок хранилища.
import { createSelector } from '@ngrx/store';
import { selectAllNotes, selectNotesMeta } from '@lingua/core/data-access';
import { Flashcard } from '@lingua/shared/models';
import { extractCardPairs, hashString } from '@lingua/shared/util';

/** Все карточки хранилища (строки «лицевая :: оборотная» во всех заметках). */
export const selectAllCards = createSelector(selectAllNotes, selectNotesMeta, (notes, meta) => {
  const cards: Flashcard[] = [];
  for (const note of notes) {
    const tags = meta.get(note.id)?.tags ?? [];
    for (const { front, back } of extractCardPairs(note.content)) {
      // id зависит от заметки и лицевой стороны: правка перевода не сбрасывает прогресс.
      cards.push({ id: hashString(`${note.id}::${front}`), noteId: note.id, front, back, tags });
    }
  }
  return cards;
});
