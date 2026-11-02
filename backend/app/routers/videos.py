# Видеотека: просмотр для всех вошедших пользователей, управление — только для администраторов.
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MediaFile, User, Video
from ..schemas import VideoIn, VideoOut, VideoUpdateIn
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/api/videos", tags=["Видеотека"])


def _get_video(db: Session, video_id: str) -> Video:
    """Видео по id или 404."""
    video = db.get(Video, video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Видео не найдено")
    return video


@router.get("", response_model=list[VideoOut])
def list_videos(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[Video]:
    """Все видео, новые сверху."""
    return list(db.scalars(select(Video).order_by(Video.created_at.desc())))


@router.post("", response_model=VideoOut, status_code=status.HTTP_201_CREATED)
def add_video(data: VideoIn, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> Video:
    """Добавляет видео по ссылке или по загруженному файлу (нужно что-то одно)."""
    if not data.url and not data.media_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Укажите ссылку на видео или загрузите файл")
    if data.id and db.get(Video, data.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Видео с таким id уже существует")

    video = Video(title=data.title.strip(), description=data.description, category=data.category.strip())
    if data.id:
        video.id = data.id

    # Загруженный файл: берём MIME-тип из базы, ссылку не сохраняем.
    if data.media_id:
        media = db.get(MediaFile, data.media_id)
        if media is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Файл не найден — загрузите его заново")
        video.media_id, video.mime_type = media.id, media.mime_type
    else:
        video.url = data.url

    db.add(video)
    db.commit()
    return video


@router.patch("/{video_id}", response_model=VideoOut)
def update_video(
    video_id: str, data: VideoUpdateIn, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> Video:
    """Изменяет название, описание или категорию видео."""
    video = _get_video(db, video_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(video, field, value.strip() if isinstance(value, str) and field != "description" else value)
    db.commit()
    return video


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(video_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> Response:
    """Удаляет видео из видеотеки (файл удаляется отдельным запросом к /api/media)."""
    db.delete(_get_video(db, video_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
