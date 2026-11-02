// Guards маршрутов: доступ только для вошедших, только для администраторов, только для гостей.
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, switchMap, take } from 'rxjs';
import { authFeature } from './auth.feature';

/** Текущий пользователь после проверки сохранённой сессии. */
function currentUser$() {
  const store = inject(Store);
  return store.select(authFeature.selectInitialized).pipe(
    filter(Boolean),
    take(1),
    switchMap(() => store.select(authFeature.selectUser).pipe(take(1))),
  );
}

/** Только для вошедших пользователей; иначе — на страницу входа с возвратом. */
export const authGuard: CanActivateFn = (_, state) => {
  const router = inject(Router);
  return currentUser$().pipe(
    map((user) =>
      user ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
    ),
  );
};

/** Только для администраторов; остальных отправляем на главную. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return currentUser$().pipe(
    map((user) => (user?.role === 'admin' ? true : router.createUrlTree(['/']))),
  );
};

/** Страницы входа и регистрации — только для гостей. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return currentUser$().pipe(map((user) => (user ? router.createUrlTree(['/']) : true)));
};
