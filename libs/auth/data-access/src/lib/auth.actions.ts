// NgRx-действия авторизации и управления пользователями.
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { LoginData, RegisterData, User, UserRole } from '@lingua/shared/models';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    /** Сессия восстановлена при запуске (user = null — никто не вошёл). */
    'Session Restored': props<{ user: User | null }>(),
    /** Запрос входа. `returnUrl` — куда вернуться после входа. */
    Login: props<{ data: LoginData; returnUrl?: string }>(),
    /** Запрос регистрации. */
    Register: props<{ data: RegisterData }>(),
    /** Успешный вход/регистрация. */
    'Login Success': props<{ user: User; returnUrl?: string }>(),
    /** Ошибка входа/регистрации. */
    'Login Failure': props<{ error: string }>(),
    /** Сбросить сообщение об ошибке (при переходе между формами). */
    'Clear Error': emptyProps(),
    /** Выход. */
    Logout: emptyProps(),
    /** Загрузить список пользователей (для администратора). */
    'Load Users': emptyProps(),
    /** Список пользователей загружен. */
    'Users Loaded': props<{ users: User[] }>(),
    /** Изменить роль пользователя. */
    'Change Role': props<{ userId: string; role: UserRole }>(),
    /** Удалить пользователя. */
    'Delete User': props<{ userId: string }>(),
    /** Ошибка операции с пользователями. */
    'Users Failure': props<{ error: string }>(),
  },
});
