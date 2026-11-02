# Общие фикстуры тестов: временная папка данных, тестовый клиент и вспомогательные функции входа.
import os
import tempfile

import pytest

# Папка данных задаётся ДО импорта приложения, чтобы тесты не трогали рабочую базу.
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="lingua-test-")
os.environ.setdefault("ADMIN_PASSWORD", "admin12345")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    """Клиент на всю сессию тестов (с запуском lifespan: таблицы и начальные данные)."""
    with TestClient(app) as c:
        yield c


def auth_header(token: str) -> dict[str, str]:
    """Заголовок авторизации для запросов."""
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token(client) -> str:
    """Токен администратора по умолчанию."""
    r = client.post("/api/auth/login", json={"email": "admin@lingua.local", "password": "admin12345"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def student(client) -> dict:
    """Зарегистрированный студент: токен и данные пользователя."""
    r = client.post(
        "/api/auth/register",
        json={"name": "Иван", "email": "Ivan@Test.ru", "password": "secret1", "role": "student"},
    )
    assert r.status_code == 201, r.text
    return r.json()
