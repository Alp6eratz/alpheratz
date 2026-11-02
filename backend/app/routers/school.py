# Сводное состояние «школы» одним запросом: уроки (с учётом прав), прогресс, заметки и видео.
# Фронтенд вызывает его после входа и после действий, меняющих доступ к урокам.
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db, utcnow
from ..models import LessonProgress, Submission, User, Video
from ..schemas import LessonOut, ReviewIn, SchoolStateOut, SubmissionOut
from ..security import get_current_user, require_admin
from ..services.access import compute_access, visible_lessons

router = APIRouter(prefix="/api", tags=["Школа"])


@router.get("/school/state", response_model=SchoolStateOut)
def school_state(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SchoolStateOut:
    """Возвращает данные курса, отфильтрованные по роли пользователя."""
    lessons = visible_lessons(db, user)
    is_admin = user.role == "admin"

    # Студент не получает материалы заблокированных уроков — только название и описание.
    access = compute_access(db, user, lessons)
    lessons_out = []
    for lesson in lessons:
        item = LessonOut.model_validate(lesson)
        if access[lesson.id].locked:
            item.materials = []
        lessons_out.append(item)

    # Администратор видит прогресс всех студентов, студент — только свой.
    progress_query = select(LessonProgress)
    if not is_admin:
        progress_query = progress_query.where(LessonProgress.user_id == user.id)

    # Администратор видит все отправленные заметки (черновики — только свои), студент — свои.
    submissions_query = select(Submission)
    if is_admin:
        submissions_query = submissions_query.where(
            (Submission.status != "draft") | (Submission.user_id == user.id)
        )
    else:
        submissions_query = submissions_query.where(Submission.user_id == user.id)

    return SchoolStateOut(
        lessons=lessons_out,
        progress=list(db.scalars(progress_query)),
        submissions=list(db.scalars(submissions_query)),
        videos=list(db.scalars(select(Video).order_by(Video.created_at.desc()))),
    )


@router.get("/submissions", response_model=list[SubmissionOut], tags=["Проверка заметок"])
def list_submissions(
    status_filter: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> list[Submission]:
    """Все отправленные заметки студентов (для проверки), с фильтром по статусу."""
    query = select(Submission).where(Submission.status != "draft").order_by(Submission.submitted_at.desc())
    if status_filter:
        query = query.where(Submission.status == status_filter)
    return list(db.scalars(query))


@router.post("/submissions/{submission_id}/review", response_model=SubmissionOut, tags=["Проверка заметок"])
def review_submission(
    submission_id: str, data: ReviewIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> Submission:
    """Проверка заметки: «принято» или «на доработку» с комментарием преподавателя."""
    note = db.get(Submission, submission_id)
    if note is None or note.status == "draft":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заметка не найдена")

    # Возврат на доработку без объяснения бесполезен для студента.
    if data.status == "needs-work" and not data.comment.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Напишите комментарий: что нужно доработать")

    note.status = data.status
    note.teacher_comment = data.comment.strip()
    note.reviewed_by = admin.id
    note.reviewed_at = note.updated_at = utcnow()
    db.commit()
    return note
