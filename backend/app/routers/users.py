# Управление пользователями (только для администраторов): список, смена роли, удаление.
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import RoleIn, UserOut
from ..security import require_admin

router = APIRouter(prefix="/api/users", tags=["Пользователи"])


def _admins_count(db: Session) -> int:
    """Количество администраторов — нельзя оставить систему без них."""
    return db.scalar(select(func.count()).select_from(User).where(User.role == "admin")) or 0


def _get_user(db: Session, user_id: str) -> User:
    """Пользователь по id или ошибка 404."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[User]:
    """Все пользователи, новые сверху."""
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.patch("/{user_id}/role", response_model=UserOut)
def change_role(
    user_id: str, data: RoleIn, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> User:
    """Назначает роль. Последнего администратора понизить нельзя."""
    user = _get_user(db, user_id)
    if user.role == "admin" and data.role == "student" and _admins_count(db) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя снять роль с последнего администратора")
    user.role = data.role
    db.commit()
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> Response:
    """Удаляет пользователя вместе с его прогрессом, заметками и личным хранилищем (каскадно)."""
    user = _get_user(db, user_id)
    # Себя удалить нельзя — чтобы случайно не потерять доступ.
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя удалить собственную учётную запись")
    if user.role == "admin" and _admins_count(db) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя удалить последнего администратора")
    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
