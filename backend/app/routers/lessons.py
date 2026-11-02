# Уроки и материалы: просмотр с учётом прав, управление для администратора,
# прогресс студента (начало/завершение урока) и заметки к уроку.
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db, utcnow
from ..models import Lesson, LessonProgress, Material, MediaFile, Submission, User
from ..schemas import (
    LessonCreateIn,
    LessonOut,
    LessonUpdateIn,
    MaterialIn,
    MaterialOut,
    MoveIn,
    ProgressOut,
    ReorderIn,
    SubmissionIn,
    SubmissionOut,
)
from ..security import get_current_user, require_admin
from ..services.access import get_accessible_lesson

router = APIRouter(prefix="/api/lessons", tags=["Уроки"])


# ---------------------------------------------------------------------------
# Вспомогательные функции
# ---------------------------------------------------------------------------


def _get_lesson(db: Session, lesson_id: str) -> Lesson:
    """Урок по id без проверки прав (для администратора) или 404."""
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Урок не найден")
    return lesson


def _get_material(lesson: Lesson, material_id: str) -> Material:
    """Материал внутри урока или 404."""
    for material in lesson.materials:
        if material.id == material_id:
            return material
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Материал не найден")


def _renumber_lessons(db: Session) -> None:
    """Пересчитывает позиции уроков подряд: 1, 2, 3… (после удаления или вставки)."""
    for index, lesson in enumerate(db.scalars(select(Lesson).order_by(Lesson.position, Lesson.created_at)), 1):
        lesson.position = index


def _renumber_materials(lesson: Lesson) -> None:
    """Пересчитывает позиции материалов урока подряд: 0, 1, 2…"""
    for index, material in enumerate(lesson.materials):
        material.position = index


def _apply_material(material: Material, data: MaterialIn, db: Session) -> None:
    """Копирует поля из запроса в материал; данные о файле берутся из базы, а не от клиента."""
    material.type = data.type
    material.title = data.title.strip()
    material.text = data.text
    material.url = data.url
    material.media_id = None
    material.file_name = material.mime_type = None
    material.size = None
    # Если указан загруженный файл — проверяем, что он существует, и подставляем его метаданные.
    if data.media_id:
        media = db.get(MediaFile, data.media_id)
        if media is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Файл не найден — загрузите его заново")
        material.media_id = media.id
        material.file_name = media.file_name
        material.mime_type = media.mime_type
        material.size = media.size
        material.url = None


# ---------------------------------------------------------------------------
# Просмотр уроков
# ---------------------------------------------------------------------------


@router.get("/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Lesson:
    """Один урок с материалами. Для студента проверяются публикация и порядок прохождения."""
    return get_accessible_lesson(db, user, lesson_id)


# ---------------------------------------------------------------------------
# Управление уроками (администратор)
# ---------------------------------------------------------------------------


@router.post("", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def create_lesson(data: LessonCreateIn, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> Lesson:
    """Создаёт урок в конце курса (по умолчанию черновиком)."""
    # Клиент может прислать собственный id (оптимистичное создание) — он должен быть свободен.
    if data.id and db.get(Lesson, data.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Урок с таким id уже существует")
    last = db.scalar(select(func.max(Lesson.position))) or 0
    lesson = Lesson(
        title=data.title.strip(),
        description=data.description,
        published=data.published,
        require_note=data.require_note,
        position=last + 1,
    )
    if data.id:
        lesson.id = data.id
    db.add(lesson)
    db.commit()
    return lesson


@router.patch("/{lesson_id}", response_model=LessonOut)
def update_lesson(
    lesson_id: str, data: LessonUpdateIn, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> Lesson:
    """Частично изменяет урок: название, описание, публикацию, требование заметки."""
    lesson = _get_lesson(db, lesson_id)
    # Применяем только поля, которые клиент действительно передал.
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lesson, field, value.strip() if field == "title" else value)
    lesson.updated_at = utcnow()
    db.commit()
    return lesson


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(lesson_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> Response:
    """Удаляет урок; материалы, прогресс и заметки к нему удаляются каскадно."""
    db.delete(_get_lesson(db, lesson_id))
    db.flush()
    _renumber_lessons(db)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/order", response_model=list[LessonOut])
def reorder_lessons(data: ReorderIn, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[Lesson]:
    """Задаёт новый порядок уроков. Уроки, не упомянутые в списке, переносятся в конец."""
    lessons = {lesson.id: lesson for lesson in db.scalars(select(Lesson))}
    ordered = [lessons.pop(i) for i in data.ids if i in lessons]
    ordered += sorted(lessons.values(), key=lambda l: l.position)
    for index, lesson in enumerate(ordered, 1):
        lesson.position = index
    db.commit()
    return ordered


# ---------------------------------------------------------------------------
# Материалы урока (администратор)
# ---------------------------------------------------------------------------


@router.post("/{lesson_id}/materials", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
def add_material(
    lesson_id: str, data: MaterialIn, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> Material:
    """Добавляет материал в конец урока."""
    lesson = _get_lesson(db, lesson_id)
    if data.id and db.get(Material, data.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Материал с таким id уже существует")
    material = Material(position=len(lesson.materials))
    if data.id:
        material.id = data.id
    _apply_material(material, data, db)
    lesson.materials.append(material)
    lesson.updated_at = utcnow()
    db.commit()
    return material


@router.put("/{lesson_id}/materials/{material_id}", response_model=MaterialOut)
def update_material(
    lesson_id: str,
    material_id: str,
    data: MaterialIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Material:
    """Полностью заменяет данные материала."""
    lesson = _get_lesson(db, lesson_id)
    material = _get_material(lesson, material_id)
    _apply_material(material, data, db)
    lesson.updated_at = utcnow()
    db.commit()
    return material


@router.delete("/{lesson_id}/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    lesson_id: str, material_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> Response:
    """Удаляет материал (загруженный файл удаляется отдельным запросом DELETE /api/media/{id})."""
    lesson = _get_lesson(db, lesson_id)
    lesson.materials.remove(_get_material(lesson, material_id))
    _renumber_materials(lesson)
    lesson.updated_at = utcnow()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{lesson_id}/materials/{material_id}/move", response_model=list[MaterialOut])
def move_material(
    lesson_id: str,
    material_id: str,
    data: MoveIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[Material]:
    """Сдвигает материал на одну позицию вверх или вниз."""
    lesson = _get_lesson(db, lesson_id)
    materials = list(lesson.materials)
    index = materials.index(_get_material(lesson, material_id))
    target = index + data.delta
    # Меняем местами с соседом, если сдвиг не выходит за границы списка.
    if 0 <= target < len(materials):
        materials[index].position, materials[target].position = target, index
        lesson.updated_at = utcnow()
        db.commit()
        db.refresh(lesson)
    return list(lesson.materials)


# ---------------------------------------------------------------------------
# Прогресс студента
# ---------------------------------------------------------------------------


def _progress(db: Session, user: User, lesson: Lesson) -> LessonProgress | None:
    """Запись прогресса пользователя по уроку (если есть)."""
    return db.scalar(
        select(LessonProgress).where(LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson.id)
    )


@router.post("/{lesson_id}/start", response_model=ProgressOut)
def start_lesson(lesson_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> LessonProgress:
    """Отмечает, что пользователь открыл урок (повторный вызов ничего не меняет)."""
    lesson = get_accessible_lesson(db, user, lesson_id)
    progress = _progress(db, user, lesson)
    if progress is None:
        progress = LessonProgress(user_id=user.id, lesson_id=lesson.id)
        db.add(progress)
        db.commit()
    return progress


@router.post("/{lesson_id}/complete", response_model=ProgressOut)
def complete_lesson(
    lesson_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> LessonProgress:
    """Завершает урок. Сервер сам проверяет порядок прохождения и обязательную заметку."""
    # Заблокированный урок завершить нельзя (403 внутри get_accessible_lesson).
    lesson = get_accessible_lesson(db, user, lesson_id)

    # Если урок требует заметку — она должна быть отправлена хотя бы один раз.
    if lesson.require_note:
        note = db.scalar(select(Submission).where(Submission.user_id == user.id, Submission.lesson_id == lesson.id))
        if note is None or note.status == "draft":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Для завершения урока отправьте заметку на проверку преподавателю",
            )

    # Создаём или обновляем запись прогресса; дата завершения ставится один раз.
    progress = _progress(db, user, lesson) or LessonProgress(user_id=user.id, lesson_id=lesson.id)
    if progress.completed_at is None:
        progress.completed_at = utcnow()
    db.add(progress)
    db.commit()
    return progress


# ---------------------------------------------------------------------------
# Заметка студента к уроку
# ---------------------------------------------------------------------------


@router.put("/{lesson_id}/submission", response_model=SubmissionOut)
def save_submission(
    lesson_id: str, data: SubmissionIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Submission:
    """Сохраняет черновик заметки или отправляет её на проверку (submit=true)."""
    lesson = get_accessible_lesson(db, user, lesson_id)
    note = db.scalar(select(Submission).where(Submission.user_id == user.id, Submission.lesson_id == lesson.id))
    if note is None:
        note = Submission(user_id=user.id, lesson_id=lesson.id)
        db.add(note)

    note.content = data.content
    note.updated_at = utcnow()
    # Отправка на проверку: меняем статус и запоминаем время.
    if data.submit:
        if not data.content.strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя отправить пустую заметку")
        note.status = "submitted"
        note.submitted_at = utcnow()
    db.commit()
    return note
