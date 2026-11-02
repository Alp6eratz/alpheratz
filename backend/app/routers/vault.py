# Личное хранилище пользователя «ключ → JSON»: заметки, папки, раскладка, настройки, прогресс карточек.
# Каждый пользователь видит и изменяет только свои записи.
import json
import re

from fastapi import APIRouter, Body, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db, utcnow
from ..models import User, VaultEntry
from ..schemas import VaultValue
from ..security import get_current_user

router = APIRouter(prefix="/api/vault", tags=["Личное хранилище"])

# Допустимые имена ключей (как на фронтенде: notes, folders, workspace, settings, flashcards…).
KEY_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")


def _check_key(key: str) -> None:
    """Проверяет имя ключа, чтобы в базу не попадал мусор."""
    if not KEY_RE.match(key):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Недопустимое имя ключа")


@router.get("")
def read_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, VaultValue]:
    """Все записи пользователя одним объектом — фронтенд загружает их сразу после входа."""
    entries = db.scalars(select(VaultEntry).where(VaultEntry.user_id == user.id))
    return {entry.key: entry.value for entry in entries}


@router.put("/{key}", status_code=status.HTTP_204_NO_CONTENT)
def write(
    key: str,
    value: VaultValue = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Создаёт или заменяет значение по ключу."""
    _check_key(key)
    # Ограничиваем размер значения, чтобы один пользователь не заполнил базу.
    if len(json.dumps(value, ensure_ascii=False).encode("utf-8")) > settings.max_vault_value_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Слишком большой объём данных")

    entry = db.get(VaultEntry, (user.id, key))
    if entry is None:
        db.add(VaultEntry(user_id=user.id, key=key, value=value))
    else:
        entry.value = value
        entry.updated_at = utcnow()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
def remove(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    """Удаляет значение по ключу (повторное удаление не ошибка)."""
    _check_key(key)
    entry = db.get(VaultEntry, (user.id, key))
    if entry is not None:
        db.delete(entry)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
