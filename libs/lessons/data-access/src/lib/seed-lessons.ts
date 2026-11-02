// Демонстрационные уроки, создаваемые при первом запуске (администратор может их изменить или удалить).
import { Lesson } from '@lingua/shared/models';
import { createId } from '@lingua/shared/util';

/** Создаёт стартовый курс из трёх уроков. */
export function createSeedLessons(): Lesson[] {
  const now = new Date().toISOString();
  const lesson = (
    order: number,
    title: string,
    description: string,
    text: string,
    requireNote = false,
  ): Lesson => ({
    id: createId(),
    title,
    description,
    order,
    published: true,
    requireNote,
    createdAt: now,
    updatedAt: now,
    materials: [{ id: createId(), type: 'text', title: 'Теория', text }],
  });
  return [
    lesson(
      1,
      'Приветствия и знакомство',
      'Базовые фразы для начала разговора на английском.',
      `## Как поздороваться

| Фраза | Перевод | Когда использовать |
|---|---|---|
| Hello | Здравствуйте | универсально |
| Hi | Привет | неформально |
| Good morning | Доброе утро | до полудня |

> [!tip] Совет
> Повторяйте фразы вслух — нажмите 🔊 рядом с карточкой.

- Nice to meet you :: Приятно познакомиться
- My name is… :: Меня зовут…`,
    ),
    lesson(
      2,
      'Глагол to be',
      'Формы am / is / are и построение простых предложений.',
      `## Формы глагола

- **I** am
- **he / she / it** is
- **we / you / they** are

==Запомните==: в вопросах глагол ставится в начало — *Are you ready?*

- I am a student :: Я студент
- They are at home :: Они дома`,
      true,
    ),
    lesson(
      3,
      'Числа и время',
      'Считаем до 100 и спрашиваем, который час.',
      `## Числа

1 — one, 2 — two, 3 — three … 10 — ten, 20 — twenty, 100 — one hundred.

## Время

- What time is it? :: Который час?
- It's half past six :: Половина седьмого

> [!example] Задание
> Напишите в заметке к уроку, во сколько вы обычно встаёте и ложитесь спать.`,
      true,
    ),
  ];
}
