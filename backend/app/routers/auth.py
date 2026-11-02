# Авторизация: регистрация, вход и получение текущего пользователя.
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db, utcnow
from ..models import User
from ..schemas import AuthOut, LoginIn, RegisterIn, UserOut
from ..security import create_token, get_current_user, hash_password, login_limiter, verify_password

router = APIRouter(prefix="/api/auth", tags=["Авторизация"])


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: Session = Depends(get_db)) -> AuthOut:
    """Регистрирует пользователя и сразу возвращает токен (автоматический вход)."""
    # Email должен быть уникальным.
    if db.scalar(select(User).where(User.email == data.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с таким email уже существует")

    # Администратором можно зарегистрироваться только с кодом приглашения.
    if data.role == "admin" and (data.invite_code or "").strip() != settings.admin_invite_code:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Неверный код приглашения администратора")

    # Создаём пользователя с хэшем пароля и отметкой первого входа.
    user = User(
        email=data.email,
        name=data.name.strip() or data.email.split("@")[0],
        role=data.role,
        password_hash=hash_password(data.password),
        last_login_at=utcnow(),
    )
    db.add(user)
    db.commit()
    return AuthOut(token=create_token(user), user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthOut)
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)) -> AuthOut:
    """Вход по email и паролю. После нескольких неудач подряд временно блокируется."""
    # Защита от перебора паролей.
    login_limiter.check(request, data.email)

    # Одинаковое сообщение для «нет пользователя» и «неверный пароль» — не раскрываем, какие email существуют.
    user = db.scalar(select(User).where(User.email == data.email))
    if user is None or not verify_password(data.password, user.password_hash):
        login_limiter.fail(request, data.email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")

    # Успешный вход: сбрасываем счётчик неудач и обновляем дату последнего входа.
    login_limiter.reset(request, data.email)
    user.last_login_at = utcnow()
    db.commit()
    return AuthOut(token=create_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    """Текущий пользователь по токену (фронтенд проверяет сессию при запуске)."""
    return user
