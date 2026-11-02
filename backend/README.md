# LinguaVault — бэкенд (Python 3)

REST API для платформы LinguaVault: регистрация и вход, роли «студент» и «администратор»,
уроки с последовательным прохождением, материалы (текст, видео, аудио, файлы), заметки студентов
на проверку, видеотека, загрузка файлов и личное хранилище заметок с синхронизацией между устройствами.

**Стек:** FastAPI · SQLAlchemy 2 · Pydantic 2 · JWT (PyJWT) · bcrypt · SQLite (или PostgreSQL) · pytest

## Быстрый старт

```bash
cd backend
```

```bash
python3 -m venv .venv
```

```bash
.venv/bin/pip install -r requirements-dev.txt
```

```bash
.venv/bin/python run.py
```

- API: http://localhost:8000
- Интерактивная документация (Swagger): http://localhost:8000/api/docs
- При первом запуске создаются администратор `admin@lingua.local` / `admin12345` и демо-курс из трёх уроков.

> На Windows вместо `.venv/bin/` используйте `.venv\Scripts\`.

## Подключение фронтенда

Фронтенд выбирает режим по файлу `apps/lingua/public/config.json`:

| `apiUrl` | Режим |
|---|---|
| `null` | локальный: всё хранится в браузере, сервер не нужен |
| `"http://localhost:8000"` | фронтенд (`npm start`, порт 4200) работает с бэкендом на порту 8000 |
| `""` | фронтенд и API на одном адресе |

### Вариант 1 — разработка (два процесса)

1. Запустите бэкенд: `.venv/bin/python run.py`
2. В `apps/lingua/public/config.json` укажите `"apiUrl": "http://localhost:8000"`
3. Запустите фронтенд из корня репозитория: `npm start` → http://localhost:4200

### Вариант 2 — один сервер (продакшен)

Соберите фронтенд и укажите бэкенду папку сборки — он раздаст сайт и сам подставит `config.json`:

```bash
npm run build
```

```bash
cd backend && STATIC_DIR=../dist/apps/lingua/browser RELOAD=0 HOST=0.0.0.0 .venv/bin/python run.py
```

## Переменные окружения

Полный список с пояснениями — в [`.env.example`](.env.example). Главное для продакшена:

| Переменная | Зачем |
|---|---|
| `SECRET_KEY` | ключ подписи токенов; без него генерируется и сохраняется в `data/secret.key` |
| `ADMIN_PASSWORD` | пароль администратора, создаваемого при первом запуске |
| `ADMIN_INVITE_CODE` | код для регистрации новых администраторов |
| `DATABASE_URL` | PostgreSQL вместо SQLite (`pip install psycopg[binary]`) |
| `CORS_ORIGINS` | адреса фронтенда, если он на другом домене |

## Структура

```
backend/
  run.py                 # запуск сервера разработки
  app/
    main.py              # приложение FastAPI, CORS, роутеры, раздача сайта
    config.py            # настройки из переменных окружения
    database.py          # движок SQLAlchemy, сессии, тип UTC-даты
    models.py            # таблицы: users, lessons, materials, lesson_progress, submissions, videos, media_files, vault_entries
    schemas.py           # схемы запросов/ответов (camelCase, как во фронтенде)
    security.py          # bcrypt, JWT, текущий пользователь, проверка роли, защита от перебора паролей
    services/
      access.py          # правила доступа к урокам (порядок прохождения)
      seed.py            # администратор и демо-курс при первом запуске
    routers/
      auth.py            # регистрация, вход, /me
      users.py           # пользователи (админ)
      lessons.py         # уроки, материалы, прогресс, заметка к уроку
      school.py          # сводное состояние курса, проверка заметок
      videos.py          # видеотека
      media.py           # загрузка и отдача файлов
      vault.py           # личное хранилище пользователя
  tests/                 # тесты API (pytest)
```

## API

Все запросы, кроме регистрации и входа, требуют заголовок `Authorization: Bearer <token>`.
Для файлов (`<video src>`, `<img>`) токен можно передать параметром `?token=`.

| Метод и путь | Кто | Описание |
|---|---|---|
| `POST /api/auth/register` | все | регистрация (админ — с `inviteCode`) → `{token, user}` |
| `POST /api/auth/login` | все | вход → `{token, user}`; 10 неудач за 5 минут → 429 |
| `GET /api/auth/me` | вошедший | текущий пользователь |
| `GET /api/users` | админ | список пользователей |
| `PATCH /api/users/{id}/role` | админ | смена роли |
| `DELETE /api/users/{id}` | админ | удаление пользователя |
| `GET /api/school/state` | вошедший | уроки, прогресс, заметки и видео (с учётом роли) |
| `GET /api/lessons/{id}` | вошедший | урок; студенту — только опубликованный и открытый |
| `POST /api/lessons` · `PATCH`/`DELETE /api/lessons/{id}` · `PUT /api/lessons/order` | админ | управление уроками |
| `POST /api/lessons/{id}/materials` · `PUT`/`DELETE …/materials/{mid}` · `POST …/{mid}/move` | админ | материалы |
| `POST /api/lessons/{id}/start` · `POST /api/lessons/{id}/complete` | вошедший | прогресс (порядок и обязательная заметка проверяются сервером) |
| `PUT /api/lessons/{id}/submission` | вошедший | черновик или отправка заметки (`submit: true`) |
| `GET /api/submissions` · `POST /api/submissions/{id}/review` | админ | проверка заметок |
| `GET /api/videos` · `POST` · `PATCH`/`DELETE /api/videos/{id}` | все / админ | видеотека |
| `POST /api/media` · `GET`/`DELETE /api/media/{id}` | админ / вошедший | файлы (поддерживается перемотка видео) |
| `GET /api/vault` · `PUT`/`DELETE /api/vault/{key}` | вошедший | личные заметки, настройки, прогресс карточек |

## Безопасность

- Пароли хранятся только в виде bcrypt-хэшей; токены — JWT с ограниченным сроком.
- Все права проверяются на сервере: студент не получит материалы закрытого урока и не завершит урок без отправленной заметки, даже обращаясь к API напрямую.
- Ссылки в материалах и видео принимаются только `http(s)://`.
- Загружаемые файлы сохраняются под случайными именами; размер ограничен `MAX_UPLOAD_MB`.
- Нельзя удалить или понизить последнего администратора и удалить самого себя.
- Перед публикацией: задайте `SECRET_KEY` и `ADMIN_PASSWORD`, включите HTTPS (например, через nginx), ограничьте `CORS_ORIGINS`.

## Тесты

```bash
.venv/bin/python -m pytest -q
```
