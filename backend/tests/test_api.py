# Сквозные тесты API: авторизация, роли, порядок прохождения уроков, заметки, видео, файлы, хранилище.
from tests.conftest import auth_header


def test_health(client):
    """Сервер отвечает на проверку работоспособности."""
    assert client.get("/api/health").json() == {"status": "ok"}


def test_register_validation_and_duplicates(client, student):
    """Email нормализуется, дубликаты и слабые пароли отклоняются, админ требует код приглашения."""
    assert student["user"]["email"] == "ivan@test.ru"
    assert student["user"]["role"] == "student"
    assert client.post("/api/auth/register", json={"name": "X", "email": "ivan@test.ru", "password": "secret1"}).status_code == 409
    assert client.post("/api/auth/register", json={"name": "X", "email": "bad", "password": "secret1"}).status_code == 422
    assert client.post("/api/auth/register", json={"name": "X", "email": "a@b.ru", "password": "123"}).status_code == 422
    r = client.post("/api/auth/register", json={"name": "X", "email": "t@b.ru", "password": "secret1", "role": "admin"})
    assert r.status_code == 403
    r = client.post(
        "/api/auth/register",
        json={"name": "Учитель", "email": "teacher@b.ru", "password": "secret1", "role": "admin", "inviteCode": "LINGUA-ADMIN"},
    )
    assert r.status_code == 201 and r.json()["user"]["role"] == "admin"


def test_login_and_me(client, student):
    """Вход возвращает токен; неверный пароль — 401; /me требует токен."""
    assert client.post("/api/auth/login", json={"email": "ivan@test.ru", "password": "wrong!"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "IVAN@test.ru", "password": "secret1"})
    assert r.status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth_header(r.json()["token"])).json()["name"] == "Иван"


def test_student_cannot_use_admin_endpoints(client, student):
    """Студенту закрыты управление пользователями, уроками, видео и загрузка файлов."""
    h = auth_header(student["token"])
    assert client.get("/api/users", headers=h).status_code == 403
    assert client.post("/api/lessons", json={"title": "x"}, headers=h).status_code == 403
    assert client.post("/api/videos", json={"title": "x", "url": "https://youtu.be/abc"}, headers=h).status_code == 403
    assert client.post("/api/media", files={"file": ("a.txt", b"hi")}, headers=h).status_code == 403


def test_lesson_order_and_notes(client, student, admin_token):
    """Уроки открываются по порядку; урок с обязательной заметкой нельзя завершить без отправки."""
    h = auth_header(student["token"])
    state = client.get("/api/school/state", headers=h).json()
    lessons = state["lessons"]
    assert [l["order"] for l in lessons] == [1, 2, 3]
    # Материалы заблокированных уроков студенту не отдаются.
    assert lessons[0]["materials"] and not lessons[1]["materials"]

    first, second = lessons[0]["id"], lessons[1]["id"]
    # Второй урок пока закрыт.
    assert client.get(f"/api/lessons/{second}", headers=h).status_code == 403
    assert client.post(f"/api/lessons/{second}/complete", headers=h).status_code == 403

    # Проходим первый урок.
    assert client.post(f"/api/lessons/{first}/start", headers=h).status_code == 200
    assert client.post(f"/api/lessons/{first}/complete", headers=h).json()["completedAt"]

    # Второй урок открылся, но требует отправленную заметку.
    assert client.get(f"/api/lessons/{second}", headers=h).status_code == 200
    assert client.post(f"/api/lessons/{second}/complete", headers=h).status_code == 400
    # Черновик не считается.
    r = client.put(f"/api/lessons/{second}/submission", json={"content": "I am a student"}, headers=h)
    assert r.json()["status"] == "draft"
    assert client.post(f"/api/lessons/{second}/complete", headers=h).status_code == 400
    # Отправляем на проверку и завершаем.
    r = client.put(f"/api/lessons/{second}/submission", json={"content": "I am a student", "submit": True}, headers=h)
    submission_id = r.json()["id"]
    assert r.json()["status"] == "submitted"
    assert client.post(f"/api/lessons/{second}/complete", headers=h).status_code == 200

    # Преподаватель проверяет заметку: на доработку без комментария нельзя.
    ah = auth_header(admin_token)
    url = f"/api/submissions/{submission_id}/review"
    assert client.post(url, json={"status": "needs-work"}, headers=ah).status_code == 400
    r = client.post(url, json={"status": "reviewed", "comment": "Отлично!"}, headers=ah)
    assert r.json()["status"] == "reviewed" and r.json()["teacherComment"] == "Отлично!"

    # Студент видит комментарий, админ видит прогресс студента.
    mine = client.get("/api/school/state", headers=h).json()["submissions"]
    assert mine[0]["teacherComment"] == "Отлично!"
    progress = client.get("/api/school/state", headers=ah).json()["progress"]
    assert sum(1 for p in progress if p["userId"] == student["user"]["id"] and p["completedAt"]) == 2


def test_admin_manages_lessons_and_materials(client, admin_token, student):
    """Администратор создаёт черновик, добавляет и сортирует материалы; студент черновик не видит."""
    ah = auth_header(admin_token)
    r = client.post("/api/lessons", json={"id": "lesson-x", "title": "Новый урок"}, headers=ah)
    assert r.status_code == 201 and r.json()["order"] == 4 and r.json()["published"] is False
    assert client.get("/api/lessons/lesson-x", headers=auth_header(student["token"])).status_code == 404

    # Материалы: текст и ссылка; небезопасная ссылка отклоняется.
    base = "/api/lessons/lesson-x/materials"
    assert client.post(base, json={"type": "text", "title": "Теория", "text": "# Hi"}, headers=ah).status_code == 201
    m2 = client.post(base, json={"id": "m2", "type": "link", "title": "Сайт", "url": "https://example.com"}, headers=ah)
    assert m2.status_code == 201
    assert client.post(base, json={"type": "link", "title": "X", "url": "javascript:alert(1)"}, headers=ah).status_code == 422
    moved = client.post(f"{base}/m2/move", json={"delta": -1}, headers=ah).json()
    assert [m["id"] for m in moved][0] == "m2"

    # Публикация, перестановка в начало и удаление.
    assert client.patch("/api/lessons/lesson-x", json={"published": True}, headers=ah).json()["published"] is True
    order = client.put("/api/lessons/order", json={"ids": ["lesson-x"]}, headers=ah).json()
    assert order[0]["id"] == "lesson-x" and order[0]["order"] == 1
    assert client.delete("/api/lessons/lesson-x", headers=ah).status_code == 204
    orders = [l["order"] for l in client.get("/api/school/state", headers=ah).json()["lessons"]]
    assert orders == [1, 2, 3]


def test_media_upload_and_video_library(client, admin_token, student):
    """Загрузка файла, отдача по токену в URL, видео из файла и по ссылке, удаление."""
    ah = auth_header(admin_token)
    r = client.post("/api/media", files={"file": ("clip.mp4", b"\x00" * 1000, "video/mp4")}, headers=ah)
    assert r.status_code == 201
    media = r.json()
    assert media["size"] == 1000 and media["mimeType"] == "video/mp4"

    # Файл доступен вошедшему пользователю по ?token= (так работает <video src>).
    r = client.get(f"/api/media/{media['mediaId']}?token={student['token']}")
    assert r.status_code == 200 and len(r.content) == 1000
    assert client.get(f"/api/media/{media['mediaId']}").status_code == 401

    # Видео из загруженного файла и по ссылке.
    v1 = client.post("/api/videos", json={"title": "Файл", "mediaId": media["mediaId"], "category": "Грамматика"}, headers=ah)
    v2 = client.post("/api/videos", json={"title": "YouTube", "url": "https://youtu.be/dQw4w9WgXcQ"}, headers=ah)
    assert v1.status_code == 201 and v2.status_code == 201
    assert client.post("/api/videos", json={"title": "Пусто"}, headers=ah).status_code == 400
    assert len(client.get("/api/videos", headers=auth_header(student["token"])).json()) == 2
    assert client.patch(f"/api/videos/{v2.json()['id']}", json={"category": "Лексика"}, headers=ah).json()["category"] == "Лексика"

    # Удаление файла обнуляет ссылку у видео.
    assert client.delete(f"/api/media/{media['mediaId']}", headers=ah).status_code == 204
    videos = {v["id"]: v for v in client.get("/api/videos", headers=ah).json()}
    assert videos[v1.json()["id"]]["mediaId"] is None
    assert client.delete(f"/api/videos/{v1.json()['id']}", headers=ah).status_code == 204


def test_vault_is_private(client, student, admin_token):
    """Личное хранилище: запись, чтение, изоляция между пользователями."""
    h = auth_header(student["token"])
    notes = [{"id": "n1", "title": "Заметка", "content": "hello :: привет"}]
    assert client.put("/api/vault/notes", json=notes, headers=h).status_code == 204
    assert client.get("/api/vault", headers=h).json()["notes"] == notes
    assert "notes" not in client.get("/api/vault", headers=auth_header(admin_token)).json()
    assert client.put("/api/vault/bad key!", json=1, headers=h).status_code in (400, 404)
    assert client.delete("/api/vault/notes", headers=h).status_code == 204
    assert client.get("/api/vault", headers=h).json() == {}


def test_user_management(client, admin_token, student):
    """Смена роли, защита последнего администратора и собственной учётной записи."""
    ah = auth_header(admin_token)
    users = client.get("/api/users", headers=ah).json()
    admin_id = next(u["id"] for u in users if u["email"] == "admin@lingua.local")
    assert client.delete(f"/api/users/{admin_id}", headers=ah).status_code == 400

    # Повышаем студента и понижаем обратно.
    sid = student["user"]["id"]
    assert client.patch(f"/api/users/{sid}/role", json={"role": "admin"}, headers=ah).json()["role"] == "admin"
    assert client.patch(f"/api/users/{sid}/role", json={"role": "student"}, headers=ah).json()["role"] == "student"

    # Удаление пользователя удаляет его прогресс (каскадно); токен перестаёт работать.
    r = client.post("/api/auth/register", json={"name": "Temp", "email": "temp@b.ru", "password": "secret1"})
    temp = r.json()
    assert client.delete(f"/api/users/{temp['user']['id']}", headers=ah).status_code == 204
    assert client.get("/api/auth/me", headers=auth_header(temp["token"])).status_code == 401


def test_login_rate_limit(client):
    """После серии неудачных попыток вход временно блокируется."""
    for _ in range(10):
        client.post("/api/auth/login", json={"email": "victim@b.ru", "password": "nope"})
    assert client.post("/api/auth/login", json={"email": "victim@b.ru", "password": "nope"}).status_code == 429
