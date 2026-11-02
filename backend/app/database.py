# Подключение к базе данных через SQLAlchemy 2: движок, фабрика сессий,
# базовый класс моделей и зависимость FastAPI для получения сессии в обработчиках.
from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from .config import settings

# Для SQLite создаём папку под файл базы и разрешаем использование соединения из разных потоков
# (FastAPI выполняет синхронные обработчики в пуле потоков).
_connect_args: dict = {}
if settings.db_url.startswith("sqlite"):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    _connect_args = {"check_same_thread": False}

# Движок БД — один на всё приложение. pool_pre_ping проверяет «живость» соединения перед запросом.
engine = create_engine(settings.db_url, connect_args=_connect_args, pool_pre_ping=True)


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _record) -> None:
    """В SQLite внешние ключи (и каскадное удаление) по умолчанию выключены — включаем."""
    if settings.db_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# Фабрика сессий: каждая HTTP-операция получает свою сессию.
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Базовый класс для всех ORM-моделей."""


class UTCDateTime(TypeDecorator):
    """Тип даты-времени, который всегда хранит и возвращает время в UTC.

    SQLite не сохраняет часовой пояс, поэтому при чтении явно помечаем значение как UTC —
    иначе на фронтенд ушли бы «наивные» даты без смещения.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        # При записи: приводим любое время к UTC.
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        # При чтении: добавляем пояс UTC, если база его потеряла.
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


def utcnow() -> datetime:
    """Текущее время в UTC (единая точка для всех отметок времени)."""
    return datetime.now(timezone.utc)


def get_db() -> Iterator[Session]:
    """Зависимость FastAPI: открывает сессию на время запроса и гарантированно закрывает её."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
