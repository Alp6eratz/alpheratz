// HTTP-клиент бэкенда: хранит токен авторизации, выполняет запросы и превращает
// ответы с ошибкой в исключения с понятным текстом на русском.
import { inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { API_CONFIG } from './api-config';

/** Ключ localStorage для токена. */
const TOKEN_KEY = 'lingua-vault:api-token';

/** Ошибка запроса к API с HTTP-статусом. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly config = inject(API_CONFIG);

  /** Срабатывает, когда сервер ответил 401 (токен истёк или пользователь удалён). */
  readonly unauthorized$ = new Subject<void>();

  /** Включён ли режим работы через сервер. */
  get enabled(): boolean {
    return this.config !== null;
  }

  /** Базовый адрес без завершающего «/». */
  get baseUrl(): string {
    return (this.config?.url ?? '').replace(/\/+$/, '');
  }

  /** Текущий токен авторизации. */
  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /** Сохраняет или удаляет токен. */
  setToken(token: string | null): void {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* localStorage недоступен — токен проживёт только до перезагрузки */
    }
  }

  /** Полный URL ресурса, к которому можно обратиться без заголовков (например, <video src>). */
  fileUrl(path: string): string {
    return `${this.baseUrl}${path}?token=${encodeURIComponent(this.token ?? '')}`;
  }

  /** GET-запрос. */
  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /** POST-запрос с JSON-телом. */
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /** PUT-запрос с JSON-телом. */
  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  /** PATCH-запрос с JSON-телом. */
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  /** DELETE-запрос. */
  delete<T = void>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /** Загрузка файла (multipart/form-data). */
  upload<T>(path: string, file: File): Promise<T> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.request<T>('POST', path, form);
  }

  /** Выполняет запрос и разбирает ответ. */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    keepalive = false,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    const token = this.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // FormData отправляется как есть (браузер сам выставит границу multipart), остальное — JSON.
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        keepalive,
      });
    } catch {
      throw new ApiError('Сервер недоступен. Проверьте подключение к интернету', 0);
    }

    // Ошибка: берём текст из поля detail ответа FastAPI.
    if (!response.ok) {
      let message = `Ошибка сервера (${response.status})`;
      try {
        const data = await response.json();
        if (typeof data?.detail === 'string') message = data.detail;
      } catch {
        /* тело не JSON — оставляем общее сообщение */
      }
      if (response.status === 401 && token) this.unauthorized$.next();
      throw new ApiError(message, response.status);
    }

    // 204 No Content — тела нет.
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Запрос, который браузер доставит даже при закрытии вкладки (для последнего сохранения). */
  sendKeepalive(method: string, path: string, body: unknown): Promise<void> {
    return this.request<void>(method, path, body, true);
  }
}
