# Настройки приложения. Все значения читаются из переменных окружения,
# чтобы один и тот же код работал локально, в Docker и на сервере.
import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

# Корневая папка бэкенда (там, где лежит requirements.txt).
BASE_DIR = Path(__file__).resolve().parent.parent

# Папка для данных по умолчанию: база SQLite, загруженные файлы, секретный ключ.
DEFAULT_DATA_DIR = BASE_DIR / "data"


def _load_secret_key(data_dir: Path) -> str:
    """Возвращает секретный ключ для подписи JWT.

    Если ключ задан в переменной SECRET_KEY — используем его. Иначе генерируем случайный ключ
    один раз и сохраняем в файл, чтобы токены пользователей не сбрасывались при перезапуске.
    """
    # Ключ из окружения имеет приоритет (так нужно делать в продакшене).
    env_key = os.getenv("SECRET_KEY")
    if env_key:
        return env_key

    # Ключ, сохранённый при предыдущем запуске.
    key_file = data_dir / "secret.key"
    if key_file.exists():
        return key_file.read_text(encoding="utf-8").strip()

    # Первый запуск: создаём криптостойкий ключ и сохраняем его с правами только для владельца.
    data_dir.mkdir(parents=True, exist_ok=True)
    key = secrets.token_urlsafe(48)
    key_file.write_text(key, encoding="utf-8")
    key_file.chmod(0o600)
    return key


def _split(value: str) -> list[str]:
    """Разбивает строку «a, b, c» на список непустых значений."""
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Неизменяемый набор настроек, создаётся один раз при старте."""

    # Папка с данными приложения.
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR", str(DEFAULT_DATA_DIR))))

    # Строка подключения к БД. По умолчанию — файл SQLite в папке данных.
    # Для PostgreSQL: postgresql+psycopg://user:pass@host/db (нужен пакет psycopg).
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", ""))

    # Время жизни токена авторизации в часах (по умолчанию неделя).
    token_ttl_hours: int = field(default_factory=lambda: int(os.getenv("TOKEN_TTL_HOURS", "168")))

    # Код приглашения, без которого нельзя зарегистрироваться администратором.
    admin_invite_code: str = field(default_factory=lambda: os.getenv("ADMIN_INVITE_CODE", "LINGUA-ADMIN"))

    # Учётная запись администратора, создаваемая при первом запуске (если пользователей нет).
    admin_email: str = field(default_factory=lambda: os.getenv("ADMIN_EMAIL", "admin@lingua.local"))
    admin_password: str = field(default_factory=lambda: os.getenv("ADMIN_PASSWORD", "admin12345"))

    # Разрешённые источники для CORS (адреса фронтенда).
    cors_origins: list[str] = field(
        default_factory=lambda: _split(os.getenv("CORS_ORIGINS", "http://localhost:4200,http://127.0.0.1:4200"))
    )

    # Максимальный размер загружаемого файла в мегабайтах.
    max_upload_mb: int = field(default_factory=lambda: int(os.getenv("MAX_UPLOAD_MB", "500")))

    # Максимальный размер одного значения в личном хранилище (заметки и т.п.) в мегабайтах.
    max_vault_value_mb: int = field(default_factory=lambda: int(os.getenv("MAX_VAULT_VALUE_MB", "10")))

    # Папка со сборкой фронтенда (dist/apps/lingua/browser). Если задана — бэкенд раздаёт и сайт.
    static_dir: str = field(default_factory=lambda: os.getenv("STATIC_DIR", ""))

    @property
    def media_dir(self) -> Path:
        """Папка для загруженных файлов (видео, аудио, документы)."""
        return self.data_dir / "media"

    @property
    def db_url(self) -> str:
        """Итоговая строка подключения: из окружения или SQLite по умолчанию."""
        return self.database_url or f"sqlite:///{self.data_dir / 'lingua.db'}"

    @property
    def secret_key(self) -> str:
        """Секретный ключ для подписи JWT."""
        return _load_secret_key(self.data_dir)


# Глобальный экземпляр настроек, который импортируют остальные модули.
settings = Settings()
