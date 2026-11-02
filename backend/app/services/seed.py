# Начальное заполнение базы при первом запуске: администратор и демонстрационный курс.
import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Lesson, Material, User
from ..security import hash_password

log = logging.getLogger("lingua.seed")

# Демонстрационные уроки: (название, описание, текст теории в Markdown, требовать заметку).
SEED_LESSONS: list[tuple[str, str, str, bool]] = [
    (
        "Приветствия и знакомство",
        "Базовые фразы для начала разговора на английском.",
        """## Как поздороваться

| Фраза | Перевод | Когда использовать |
|---|---|---|
| Hello | Здравствуйте | универсально |
| Hi | Привет | неформально |
| Good morning | Доброе утро | до полудня |

> [!tip] Совет
> Повторяйте фразы вслух — нажмите 🔊 рядом с карточкой.

- Nice to meet you :: Приятно познакомиться
- My name is… :: Меня зовут…""",
        False,
    ),
    (
        "Глагол to be",
        "Формы am / is / are и построение простых предложений.",
        """## Формы глагола

- **I** am
- **he / she / it** is
- **we / you / they** are

==Запомните==: в вопросах глагол ставится в начало — *Are you ready?*

- I am a student :: Я студент
- They are at home :: Они дома""",
        True,
    ),
    (
        "Числа и время",
        "Считаем до 100 и спрашиваем, который час.",
        """## Числа

1 — one, 2 — two, 3 — three … 10 — ten, 20 — twenty, 100 — one hundred.

## Время

- What time is it? :: Который час?
- It's half past six :: Половина седьмого

> [!example] Задание
> Напишите в заметке к уроку, во сколько вы обычно встаёте и ложитесь спать.""",
        True,
    ),
]


def seed_database(db: Session) -> None:
    """Создаёт администратора и демо-курс, если база пустая. Повторный вызов ничего не меняет."""
    # Администратор по умолчанию — только если в базе ещё нет ни одного пользователя.
    if db.scalar(select(func.count()).select_from(User)) == 0:
        db.add(
            User(
                email=settings.admin_email.lower(),
                name="Администратор",
                role="admin",
                password_hash=hash_password(settings.admin_password),
            )
        )
        log.warning(
            "Создан администратор %s. Обязательно смените пароль (переменная ADMIN_PASSWORD) в продакшене!",
            settings.admin_email,
        )

    # Демо-курс — только если уроков ещё нет.
    if db.scalar(select(func.count()).select_from(Lesson)) == 0:
        for position, (title, description, text, require_note) in enumerate(SEED_LESSONS, start=1):
            lesson = Lesson(
                title=title,
                description=description,
                position=position,
                published=True,
                require_note=require_note,
            )
            lesson.materials.append(Material(type="text", title="Теория", text=text, position=0))
            db.add(lesson)

    db.commit()
