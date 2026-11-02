# Загруженные файлы: приём (администратор), отдача с поддержкой перемотки видео, удаление.
import mimetypes
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import MediaFile, User
from ..schemas import MediaOut
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/api/media", tags=["Файлы"])

# Размер блока при копировании загрузки на диск.
CHUNK = 1024 * 1024


def _media_path(media: MediaFile) -> Path:
    """Путь к файлу на диске."""
    return settings.media_dir / media.storage_name


@router.post("", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
def upload(file: UploadFile = File(...), db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> MediaFile:
    """Сохраняет файл на диск по частям, не загружая его целиком в память, и проверяет размер."""
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    limit = settings.max_upload_mb * 1024 * 1024

    # Имя на диске — случайное: исключает перезапись и обход каталогов через «../».
    suffix = Path(file.filename or "").suffix.lower()[:16]
    storage_name = f"{uuid.uuid4().hex}{suffix}"
    target = settings.media_dir / storage_name

    # Копируем поток в файл, считая байты; при превышении лимита удаляем недописанный файл.
    size = 0
    try:
        with target.open("wb") as out:
            while chunk := file.file.read(CHUNK):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"Файл больше {settings.max_upload_mb} МБ",
                    )
                out.write(chunk)
    except BaseException:
        target.unlink(missing_ok=True)
        raise

    # MIME-тип: от клиента, а если его нет — по расширению файла.
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    media = MediaFile(
        file_name=(file.filename or storage_name)[:255],
        mime_type=mime,
        size=size,
        storage_name=storage_name,
        uploaded_by=admin.id,
    )
    db.add(media)
    db.commit()
    return media


@router.get("/{media_id}")
def download(media_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> FileResponse:
    """Отдаёт файл. FileResponse поддерживает Range-запросы — видео можно перематывать.

    Токен можно передать в параметре ?token=, потому что теги <video>/<audio>/<img>
    не умеют отправлять заголовок Authorization.
    """
    media = db.get(MediaFile, media_id)
    if media is None or not _media_path(media).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Файл не найден")
    # Изображения, видео и аудио показываем в браузере, остальное — скачиваем под исходным именем.
    inline = media.mime_type.split("/")[0] in {"image", "video", "audio"} or media.mime_type == "application/pdf"
    return FileResponse(
        _media_path(media),
        media_type=media.mime_type,
        filename=media.file_name,
        content_disposition_type="inline" if inline else "attachment",
    )


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(media_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> Response:
    """Удаляет файл с диска и запись о нём; ссылки в материалах и видео обнуляются (SET NULL)."""
    media = db.get(MediaFile, media_id)
    if media is not None:
        _media_path(media).unlink(missing_ok=True)
        db.delete(media)
        db.commit()
    # Повторное удаление не считается ошибкой (идемпотентность).
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def disk_usage() -> int:
    """Суммарный размер загруженных файлов в байтах (для мониторинга)."""
    if not settings.media_dir.exists():
        return 0
    return sum(p.stat().st_size for p in settings.media_dir.iterdir() if p.is_file())

