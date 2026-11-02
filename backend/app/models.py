# ORM-модели (таблицы базы данных). Структура повторяет модели фронтенда:
# пользователи, уроки и материалы, прогресс, заметки к урокам, видеотека, файлы и личное хранилище.
import uuid

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base, UTCDateTime, utcnow


def new_id() -> str:
    """Генерирует уникальный идентификатор (UUID4 в виде строки)."""
    return str(uuid.uuid4())


class User(Base):
    """Пользователь платформы: студент или администратор (преподаватель)."""

    __tablename__ = "users"

    # Первичный ключ и учётные данные.
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    # Роль: "admin" или "student".
    role: Mapped[str] = mapped_column(String(16), default="student")
    # Хэш пароля bcrypt (сам пароль никогда не хранится).
    password_hash: Mapped[str] = mapped_column(String(255))
    # Даты регистрации и последнего входа.
    created_at = mapped_column(UTCDateTime, default=utcnow)
    last_login_at = mapped_column(UTCDateTime, nullable=True)


class MediaFile(Base):
    """Загруженный файл (видео, аудио, изображение, документ). Сам файл лежит на диске."""

    __tablename__ = "media_files"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    # Исходное имя файла и его тип — для правильной отдачи браузеру.
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(127))
    size: Mapped[int] = mapped_column(Integer)
    # Имя файла на диске внутри папки media (не зависит от пользовательского имени).
    storage_name: Mapped[str] = mapped_column(String(255), unique=True)
    # Кто загрузил (при удалении пользователя ссылка обнуляется, файл остаётся).
    uploaded_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = mapped_column(UTCDateTime, default=utcnow)


class Lesson(Base):
    """Урок курса. Уроки проходятся строго по порядку поля position."""

    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    # Порядковый номер в курсе (1, 2, 3…).
    position: Mapped[int] = mapped_column(Integer, default=1, index=True)
    # Черновики (published = False) видят только администраторы.
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    # Требовать отправку заметки на проверку перед завершением урока.
    require_note: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at = mapped_column(UTCDateTime, default=utcnow)
    updated_at = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    # Материалы урока в нужном порядке; удаляются вместе с уроком.
    materials: Mapped[list["Material"]] = relationship(
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="Material.position",
    )


class Material(Base):
    """Учебный материал урока: текст, видео, аудио, изображение, файл или ссылка."""

    __tablename__ = "materials"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    # Позиция внутри урока.
    position: Mapped[int] = mapped_column(Integer, default=0)
    # Тип материала: text | video | audio | image | file | link.
    type: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(255))
    # Текст в Markdown (для типа text) или описание к медиа.
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Внешняя ссылка (YouTube, Vimeo, сайт).
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    # Загруженный файл (при удалении файла ссылка обнуляется).
    media_id: Mapped[str | None] = mapped_column(
        ForeignKey("media_files.id", ondelete="SET NULL"), nullable=True
    )
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(127), nullable=True)
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    lesson: Mapped[Lesson] = relationship(back_populates="materials")


class LessonProgress(Base):
    """Прогресс пользователя по уроку: когда начал и когда завершил."""

    __tablename__ = "lesson_progress"
    # Для каждой пары «пользователь + урок» — одна запись.
    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_progress_user_lesson"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    started_at = mapped_column(UTCDateTime, default=utcnow)
    completed_at = mapped_column(UTCDateTime, nullable=True)


class Submission(Base):
    """Заметка студента к уроку, которую проверяет преподаватель."""

    __tablename__ = "submissions"
    # У студента одна заметка на урок (её можно дорабатывать и отправлять повторно).
    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_submission_user_lesson"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    # Статус: draft | submitted | needs-work | reviewed.
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    teacher_comment: Mapped[str] = mapped_column(Text, default="")
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at = mapped_column(UTCDateTime, nullable=True)
    reviewed_at = mapped_column(UTCDateTime, nullable=True)
    updated_at = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Video(Base):
    """Видео в видеотеке: по внешней ссылке или загруженным файлом."""

    __tablename__ = "videos"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    media_id: Mapped[str | None] = mapped_column(
        ForeignKey("media_files.id", ondelete="SET NULL"), nullable=True
    )
    mime_type: Mapped[str | None] = mapped_column(String(127), nullable=True)
    category: Mapped[str] = mapped_column(String(120), default="")
    created_at = mapped_column(UTCDateTime, default=utcnow)


class VaultEntry(Base):
    """Личное хранилище пользователя «ключ → JSON» (заметки, папки, настройки, прогресс карточек).

    Повторяет абстракцию VaultStorage на фронтенде, поэтому заметки синхронизируются
    между устройствами без изменения логики приложения.
    """

    __tablename__ = "vault_entries"

    # Составной первичный ключ: пользователь + ключ.
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    # Произвольное JSON-значение.
    value = mapped_column(JSON)
    updated_at = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
