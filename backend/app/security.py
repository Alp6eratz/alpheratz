# Безопасность: хэширование паролей (bcrypt), выпуск и проверка JWT-токенов,
# зависимости FastAPI для получения текущего пользователя и проверки роли администратора.
import time
from collections import defaultdict, deque
from datetime import timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db, utcnow
from .models import User

# Алгоритм подписи токенов (симметричный ключ из настроек).
ALGORITHM = "HS256"

# Схема «Authorization: Bearer <token>». auto_error=False — чтобы токен можно было
# передать и в query-параметре (нужно для <video src>, где заголовки задать нельзя).
bearer_scheme = HTTPBearer(auto_error=False)

# Секретный ключ вычисляется один раз при импорте модуля.
_SECRET = settings.secret_key


def hash_password(password: str) -> str:
    """Возвращает bcrypt-хэш пароля (соль генерируется автоматически)."""
    # bcrypt учитывает только первые 72 байта — обрезаем явно, чтобы поведение было предсказуемым.
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Проверяет пароль по хэшу за постоянное время."""
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except ValueError:
        # Повреждённый хэш в базе — считаем пароль неверным.
        return False


def create_token(user: User) -> str:
    """Выпускает JWT с id пользователя и сроком действия из настроек."""
    now = utcnow()
    payload = {
        "sub": user.id,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(hours=settings.token_ttl_hours),
    }
    return jwt.encode(payload, _SECRET, algorithm=ALGORITHM)


def _unauthorized(detail: str = "Требуется вход в систему") -> HTTPException:
    """Ошибка 401 с заголовком, который подсказывает клиенту схему авторизации."""
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    token: str | None = Query(default=None, description="Токен для ссылок на медиафайлы"),
    db: Session = Depends(get_db),
) -> User:
    """Зависимость: возвращает пользователя по токену из заголовка или параметра ?token=."""
    # Берём токен из заголовка Authorization, иначе — из query-параметра.
    raw = credentials.credentials if credentials else token
    if not raw:
        raise _unauthorized()

    # Проверяем подпись и срок действия токена.
    try:
        payload = jwt.decode(raw, _SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Сессия истекла, войдите снова")
    except jwt.InvalidTokenError:
        raise _unauthorized("Недействительный токен")

    # Пользователь мог быть удалён после выдачи токена.
    user = db.get(User, payload.get("sub"))
    if user is None:
        raise _unauthorized("Пользователь не найден")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Зависимость: пропускает только администраторов, остальным — 403."""
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только администраторам")
    return user


class LoginRateLimiter:
    """Простой ограничитель попыток входа: не больше N неудач за окно времени с одного IP + email.

    Защищает от перебора паролей. Хранит данные в памяти процесса — для нескольких
    экземпляров сервера стоит перенести счётчики в Redis.
    """

    def __init__(self, max_attempts: int = 10, window_seconds: int = 300) -> None:
        self.max_attempts = max_attempts
        self.window = window_seconds
        # Ключ → очередь времён неудачных попыток.
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _key(self, request: Request, email: str) -> str:
        # Ключ учитывает и адрес клиента, и email.
        client = request.client.host if request.client else "unknown"
        return f"{client}:{email}"

    def _prune(self, key: str) -> deque[float]:
        # Удаляем попытки, вышедшие за пределы окна.
        attempts = self._failures[key]
        border = time.monotonic() - self.window
        while attempts and attempts[0] < border:
            attempts.popleft()
        return attempts

    def check(self, request: Request, email: str) -> None:
        """Бросает 429, если лимит неудачных попыток исчерпан."""
        if len(self._prune(self._key(request, email))) >= self.max_attempts:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Слишком много попыток входа. Попробуйте через несколько минут",
            )

    def fail(self, request: Request, email: str) -> None:
        """Запоминает неудачную попытку."""
        self._failures[self._key(request, email)].append(time.monotonic())

    def reset(self, request: Request, email: str) -> None:
        """Сбрасывает счётчик после успешного входа."""
        self._failures.pop(self._key(request, email), None)


# Общий экземпляр ограничителя.
login_limiter = LoginRateLimiter()
