// Эффекты авторизации: восстановление сессии, вход, регистрация, выход,
// открытие хранилища заметок пользователя и операции администратора с пользователями.
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { NotesActions } from '@lingua/core/data-access';
import { catchError, defer, exhaustMap, filter, from, map, of, tap } from 'rxjs';
import { AuthActions } from './auth.actions';
import { AuthBackend } from './auth-backend';

/** Сообщение ошибки из исключения. */
const message = (e: unknown) => (e instanceof Error ? e.message : 'Неизвестная ошибка');

/** Восстановление сессии сразу при регистрации эффектов (до первой навигации). */
export const restoreSession$ = createEffect(
  (backend = inject(AuthBackend)) =>
    defer(() => of(AuthActions.sessionRestored({ user: backend.restoreSession() }))),
  { functional: true },
);

/** Вход. exhaustMap игнорирует повторные нажатия, пока запрос выполняется. */
export const login$ = createEffect(
  (actions$ = inject(Actions), backend = inject(AuthBackend)) =>
    actions$.pipe(
      ofType(AuthActions.login),
      exhaustMap(({ data, returnUrl }) =>
        from(backend.login(data)).pipe(
          map((user) => AuthActions.loginSuccess({ user, returnUrl })),
          catchError((e) => of(AuthActions.loginFailure({ error: message(e) }))),
        ),
      ),
    ),
  { functional: true },
);

/** Регистрация. */
export const register$ = createEffect(
  (actions$ = inject(Actions), backend = inject(AuthBackend)) =>
    actions$.pipe(
      ofType(AuthActions.register),
      exhaustMap(({ data }) =>
        from(backend.register(data)).pipe(
          map((user) => AuthActions.loginSuccess({ user })),
          catchError((e) => of(AuthActions.loginFailure({ error: message(e) }))),
        ),
      ),
    ),
  { functional: true },
);

/** После входа открываем личное хранилище заметок пользователя. */
export const openUserVault$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AuthActions.sessionRestored, AuthActions.loginSuccess),
      map(({ user }) => user),
      filter((user) => !!user),
      map((user) => NotesActions.openVault({ scope: user.id })),
    ),
  { functional: true },
);

/** Переход после входа: на запрошенную страницу или на главную. */
export const redirectAfterLogin$ = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(AuthActions.loginSuccess),
      tap(({ returnUrl }) => router.navigateByUrl(returnUrl || '/')),
    ),
  { functional: true, dispatch: false },
);

/** Выход: завершаем сессию, закрываем хранилище и переходим на страницу входа. */
export const logout$ = createEffect(
  (actions$ = inject(Actions), backend = inject(AuthBackend), router = inject(Router)) =>
    actions$.pipe(
      ofType(AuthActions.logout),
      tap(() => {
        backend.logout();
        router.navigateByUrl('/login');
      }),
      map(() => NotesActions.vaultClosed()),
    ),
  { functional: true },
);

/** Загрузка списка пользователей. */
export const loadUsers$ = createEffect(
  (actions$ = inject(Actions), backend = inject(AuthBackend)) =>
    actions$.pipe(
      ofType(AuthActions.loadUsers, AuthActions.loginSuccess, AuthActions.sessionRestored),
      map(() => AuthActions.usersLoaded({ users: backend.listUsers() })),
    ),
  { functional: true },
);

/** Изменение роли пользователя администратором. */
export const changeRole$ = createEffect(
  (actions$ = inject(Actions), backend = inject(AuthBackend)) =>
    actions$.pipe(
      ofType(AuthActions.changeRole),
      map(({ userId, role }) => {
        try {
          backend.updateRole(userId, role);
          return AuthActions.usersLoaded({ users: backend.listUsers() });
        } catch (e) {
          return AuthActions.usersFailure({ error: message(e) });
        }
      }),
    ),
  { functional: true },
);

/** Удаление пользователя администратором. */
export const deleteUser$ = createEffect(
  (actions$ = inject(Actions), backend = inject(AuthBackend)) =>
    actions$.pipe(
      ofType(AuthActions.deleteUser),
      map(({ userId }) => {
        try {
          backend.deleteUser(userId);
          return AuthActions.usersLoaded({ users: backend.listUsers() });
        } catch (e) {
          return AuthActions.usersFailure({ error: message(e) });
        }
      }),
    ),
  { functional: true },
);

export const authEffects = {
  restoreSession$,
  login$,
  register$,
  openUserVault$,
  redirectAfterLogin$,
  logout$,
  loadUsers$,
  changeRole$,
  deleteUser$,
};
