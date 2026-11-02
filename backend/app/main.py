# Точка входа бэкенда: создание приложения FastAPI, CORS, подключение роутеров,
# создание таблиц и начальных данных при старте, раздача собранного фронтенда (необязательно).
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import auth, lessons, media, school, users, vault, videos
from .services.seed import seed_database

# Базовая настройка логирования: время, уровень, источник, сообщение.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Действия при запуске сервера: создать таблицы, папки и начальные данные."""
    # Таблицы создаются, если их ещё нет (для изменения схемы в будущем стоит подключить Alembic).
    Base.metadata.create_all(bind=engine)
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    # Администратор и демо-курс при первом запуске.
    with SessionLocal() as db:
        seed_database(db)
    yield


# Само приложение; документация API доступна по адресу /api/docs.
app = FastAPI(
    title="LinguaVault API",
    description="Бэкенд платформы изучения языков: авторизация, уроки, проверка заметок, видеотека.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# CORS: разрешаем запросы с адресов фронтенда (во время разработки это http://localhost:4200).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Ошибки валидации отдаём одним понятным сообщением в поле detail (как и остальные ошибки API)."""
    first = exc.errors()[0] if exc.errors() else {}
    message = str(first.get("msg", "Некорректные данные")).removeprefix("Value error, ")
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    return JSONResponse(status_code=422, content={"detail": f"{field}: {message}" if field else message})


# Подключаем все группы маршрутов API.
for module in (auth, users, lessons, school, videos, media, vault):
    app.include_router(module.router)


@app.get("/api/health", tags=["Служебное"])
def health() -> dict[str, str]:
    """Проверка работоспособности (для мониторинга и балансировщиков)."""
    return {"status": "ok"}


# Если указана папка со сборкой фронтенда — раздаём её, чтобы сайт и API работали на одном адресе.
if settings.static_dir and Path(settings.static_dir).is_dir():
    static_root = Path(settings.static_dir).resolve()

    @app.get("/config.json", include_in_schema=False)
    def runtime_config() -> dict[str, str]:
        """Настройки для фронтенда: API находится на этом же адресе (пустая строка = тот же сервер)."""
        return {"apiUrl": ""}

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        """Отдаёт файл сборки, а для всех остальных адресов — index.html (одностраничное приложение)."""
        candidate = (static_root / path).resolve()
        # Защита от выхода за пределы папки сборки через «../».
        if path and candidate.is_file() and static_root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(static_root / "index.html")
