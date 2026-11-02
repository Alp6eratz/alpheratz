# Схемы Pydantic: что принимает и что возвращает API.
# Поля в JSON используют camelCase (как в TypeScript-моделях фронтенда), в Python — snake_case.
import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

# Допустимые значения перечислений — те же, что во фронтенде.
Role = Literal["admin", "student"]
MaterialType = Literal["text", "video", "audio", "image", "file", "link"]
SubmissionStatus = Literal["draft", "submitted", "needs-work", "reviewed"]

# Клиент может сам задать id (фронтенд создаёт объекты оптимистично) — проверяем формат.
ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"

# Простая проверка email без внешних зависимостей.
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ApiModel(BaseModel):
    """Базовая схема: camelCase в JSON, чтение из ORM-объектов, принимаются оба варианта имён."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------------------------------------------------------------------------
# Пользователи и авторизация
# ---------------------------------------------------------------------------


class UserOut(ApiModel):
    """Публичные данные пользователя (без хэша пароля)."""

    id: str
    email: str
    name: str
    role: Role
    created_at: datetime
    last_login_at: datetime | None = None


class RegisterIn(ApiModel):
    """Данные формы регистрации."""

    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=255)
    password: str = Field(min_length=6, max_length=128)
    role: Role = "student"
    # Обязателен только для регистрации администратора.
    invite_code: str | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        # Email сравниваем без учёта регистра и пробелов.
        value = value.strip().lower()
        if not EMAIL_RE.match(value):
            raise ValueError("Введите корректный email")
        return value


class LoginIn(ApiModel):
    """Данные формы входа."""

    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class AuthOut(ApiModel):
    """Ответ на вход/регистрацию: токен доступа и пользователь."""

    token: str
    user: UserOut


class RoleIn(ApiModel):
    """Смена роли пользователя администратором."""

    role: Role


# ---------------------------------------------------------------------------
# Уроки и материалы
# ---------------------------------------------------------------------------


class MaterialIn(ApiModel):
    """Создание/изменение материала. id можно передать с клиента."""

    id: str | None = Field(default=None, pattern=ID_PATTERN)
    type: MaterialType
    title: str = Field(min_length=1, max_length=255)
    text: str | None = None
    url: str | None = Field(default=None, max_length=2048)
    media_id: str | None = None
    file_name: str | None = None
    mime_type: str | None = None
    size: int | None = None

    @field_validator("url")
    @classmethod
    def check_url(cls, value: str | None) -> str | None:
        # Разрешаем только http(s)-ссылки — защита от javascript: и подобных схем.
        if value and not re.match(r"^https?://\S+$", value.strip()):
            raise ValueError("Ссылка должна начинаться с http:// или https://")
        return value.strip() if value else None


class MaterialOut(ApiModel):
    """Материал в ответе API."""

    id: str
    type: MaterialType
    title: str
    text: str | None = None
    url: str | None = None
    media_id: str | None = None
    file_name: str | None = None
    mime_type: str | None = None
    size: int | None = None


class LessonCreateIn(ApiModel):
    """Создание урока."""

    id: str | None = Field(default=None, pattern=ID_PATTERN)
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    published: bool = False
    require_note: bool = False


class LessonUpdateIn(ApiModel):
    """Частичное изменение урока (передаются только изменённые поля)."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    published: bool | None = None
    require_note: bool | None = None


class LessonOut(ApiModel):
    """Урок в ответе API. Поле order соответствует position в базе."""

    id: str
    title: str
    description: str
    order: int = Field(validation_alias="position")
    published: bool
    require_note: bool
    materials: list[MaterialOut]
    created_at: datetime
    updated_at: datetime


class ReorderIn(ApiModel):
    """Новый порядок уроков — список id."""

    ids: list[str]


class MoveIn(ApiModel):
    """Сдвиг материала вверх (-1) или вниз (+1)."""

    delta: int = Field(ge=-1, le=1)


# ---------------------------------------------------------------------------
# Прогресс и заметки к урокам
# ---------------------------------------------------------------------------


class ProgressOut(ApiModel):
    """Прогресс пользователя по уроку."""

    user_id: str
    lesson_id: str
    started_at: datetime
    completed_at: datetime | None = None


class SubmissionIn(ApiModel):
    """Сохранение заметки студентом. submit=True — отправить на проверку."""

    content: str = Field(max_length=200_000)
    submit: bool = False


class ReviewIn(ApiModel):
    """Проверка заметки преподавателем."""

    status: Literal["needs-work", "reviewed"]
    comment: str = Field(default="", max_length=20_000)


class SubmissionOut(ApiModel):
    """Заметка в ответе API."""

    id: str
    lesson_id: str
    user_id: str
    content: str
    status: SubmissionStatus
    teacher_comment: str
    reviewed_by: str | None = None
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    updated_at: datetime


# ---------------------------------------------------------------------------
# Видеотека и файлы
# ---------------------------------------------------------------------------


class VideoIn(ApiModel):
    """Добавление видео: по ссылке или по id загруженного файла."""

    id: str | None = Field(default=None, pattern=ID_PATTERN)
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    category: str = Field(default="", max_length=120)
    url: str | None = Field(default=None, max_length=2048)
    media_id: str | None = None

    @field_validator("url")
    @classmethod
    def check_url(cls, value: str | None) -> str | None:
        if value and not re.match(r"^https?://\S+$", value.strip()):
            raise ValueError("Ссылка должна начинаться с http:// или https://")
        return value.strip() if value else None


class VideoUpdateIn(ApiModel):
    """Частичное изменение видео."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=120)


class VideoOut(ApiModel):
    """Видео в ответе API."""

    id: str
    title: str
    description: str
    url: str | None = None
    media_id: str | None = None
    mime_type: str | None = None
    category: str
    created_at: datetime


class MediaOut(ApiModel):
    """Результат загрузки файла."""

    media_id: str = Field(validation_alias="id")
    file_name: str
    mime_type: str
    size: int


# ---------------------------------------------------------------------------
# Сводное состояние школы (одним запросом при входе)
# ---------------------------------------------------------------------------


class SchoolStateOut(ApiModel):
    """Всё, что нужно фронтенду после входа: уроки, прогресс, заметки, видео."""

    lessons: list[LessonOut]
    progress: list[ProgressOut]
    submissions: list[SubmissionOut]
    videos: list[VideoOut]


# Произвольное JSON-значение личного хранилища.
VaultValue = Any
