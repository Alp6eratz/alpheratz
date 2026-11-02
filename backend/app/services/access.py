# Правила доступа к урокам — проверяются на сервере, а не только в интерфейсе:
# студент видит только опубликованные уроки и не может открыть следующий, пока не завершил предыдущий.
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Lesson, LessonProgress, User


@dataclass(frozen=True)
class LessonAccess:
    """Состояние урока для пользователя."""

    locked: bool
    completed: bool
    started: bool


def visible_lessons(db: Session, user: User) -> list[Lesson]:
    """Уроки, которые видит пользователь: администратор — все, студент — только опубликованные."""
    query = select(Lesson).order_by(Lesson.position)
    if user.role != "admin":
        query = query.where(Lesson.published.is_(True))
    return list(db.scalars(query))


def compute_access(db: Session, user: User, lessons: list[Lesson] | None = None) -> dict[str, LessonAccess]:
    """Вычисляет доступ к каждому видимому уроку (та же логика, что и на фронтенде)."""
    lessons = lessons if lessons is not None else visible_lessons(db, user)

    # Прогресс пользователя по всем урокам одним запросом.
    progress = {
        p.lesson_id: p for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id))
    }

    # Идём по урокам по порядку: урок закрыт, если хотя бы один предыдущий не завершён.
    result: dict[str, LessonAccess] = {}
    previous_completed = True
    for lesson in lessons:
        p = progress.get(lesson.id)
        completed = bool(p and p.completed_at)
        result[lesson.id] = LessonAccess(
            locked=user.role != "admin" and not previous_completed,
            completed=completed,
            started=p is not None,
        )
        previous_completed = previous_completed and completed
    return result


def get_accessible_lesson(db: Session, user: User, lesson_id: str) -> Lesson:
    """Возвращает урок, если пользователь имеет к нему доступ; иначе 404 или 403."""
    lesson = db.get(Lesson, lesson_id)

    # Несуществующий урок или черновик (для студента) — «не найден».
    if lesson is None or (user.role != "admin" and not lesson.published):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Урок не найден")

    # Заблокированный урок — «доступ запрещён» с понятным объяснением.
    access = compute_access(db, user).get(lesson.id)
    if access and access.locked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Сначала пройдите предыдущие уроки")
    return lesson
