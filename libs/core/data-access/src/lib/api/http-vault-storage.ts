// Хранилище заметок на сервере. Интерфейс VaultStorage синхронный, поэтому данные пользователя
// загружаются в кэш один раз при входе (prepare), а изменения отправляются на сервер с задержкой.
import { DestroyRef, inject, Injectable } from '@angular/core';
import { VaultStorage } from '../storage/vault-storage';
import { ApiClient } from './api-client';

/** Задержка перед отправкой изменений (мс) — чтобы не слать запрос на каждый символ. */
const SAVE_DELAY = 800;

@Injectable()
export class HttpVaultStorage extends VaultStorage {
  private readonly api = inject(ApiClient);
  /** Кэш значений текущего пользователя: ключ сервера → значение. */
  private cache = new Map<string, unknown>();
  /** Ключи, ожидающие отправки, и их таймеры. */
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    super();
    // При закрытии вкладки отправляем несохранённые изменения.
    const onUnload = () => this.flushKeepalive();
    window.addEventListener('pagehide', onUnload);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('pagehide', onUnload));
  }

  /** Загружает все записи пользователя с сервера в кэш. */
  override async prepare(): Promise<void> {
    await this.flush();
    this.cache = new Map(Object.entries(await this.api.get<Record<string, unknown>>('/api/vault')));
  }

  read<T>(key: string): T | null {
    return (this.cache.get(this.serverKey(key)) as T | undefined) ?? null;
  }

  write<T>(key: string, value: T): void {
    const serverKey = this.serverKey(key);
    this.cache.set(serverKey, value);
    // Перезапускаем таймер отправки для этого ключа.
    clearTimeout(this.pending.get(serverKey));
    this.pending.set(
      serverKey,
      setTimeout(() => this.send(serverKey), SAVE_DELAY),
    );
  }

  remove(key: string): void {
    const serverKey = this.serverKey(key);
    this.cache.delete(serverKey);
    clearTimeout(this.pending.get(serverKey));
    this.pending.delete(serverKey);
    this.api.delete(`/api/vault/${encodeURIComponent(serverKey)}`).catch((e) => console.warn(e));
  }

  /** Немедленно отправляет все отложенные изменения. */
  override async flush(): Promise<void> {
    const keys = [...this.pending.keys()];
    keys.forEach((k) => clearTimeout(this.pending.get(k)));
    await Promise.all(keys.map((k) => this.send(k)));
  }

  /** Отправляет одно значение на сервер. */
  private async send(serverKey: string): Promise<void> {
    this.pending.delete(serverKey);
    try {
      await this.api.put(
        `/api/vault/${encodeURIComponent(serverKey)}`,
        this.cache.get(serverKey) ?? null,
      );
    } catch (error) {
      console.warn('[LinguaVault] Не удалось сохранить на сервере', error);
    }
  }

  /** Последняя отправка при закрытии страницы (keepalive-запросы). */
  private flushKeepalive(): void {
    for (const [key, timer] of this.pending) {
      clearTimeout(timer);
      this.api
        .sendKeepalive('PUT', `/api/vault/${encodeURIComponent(key)}`, this.cache.get(key) ?? null)
        .catch(() => undefined);
    }
    this.pending.clear();
  }

  /**
   * Ключ на сервере. Локально данные пользователей разделяются префиксом `user:<id>:`,
   * а на сервере пользователь определяется токеном — префикс отбрасываем.
   */
  private serverKey(key: string): string {
    return key.replace(/^user:[^:]+:/, '');
  }
}
