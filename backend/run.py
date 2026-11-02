# Запуск сервера разработки: python run.py (адрес http://localhost:8000, документация /api/docs).
import os

import uvicorn

if __name__ == "__main__":
    # Хост и порт можно переопределить переменными окружения HOST и PORT.
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        # Автоперезапуск при изменении кода — только для разработки.
        reload=os.getenv("RELOAD", "1") == "1",
    )
