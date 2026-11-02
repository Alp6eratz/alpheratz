// NgRx-фича «auth»: текущий пользователь, список пользователей и состояние запросов.
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { User } from '@lingua/shared/models';
import { AuthActions } from './auth.actions';

/** Состояние авторизации. */
export interface AuthState {
  /** Вошедший пользователь или null. */
  user: User | null;
  /** Все пользователи (заполняется для администраторов). */
  users: User[];
  /** Проверена ли сохранённая сессия (до этого guards ждут). */
  initialized: boolean;
  /** Выполняется ли запрос входа/регистрации. */
  pending: boolean;
  /** Текст последней ошибки. */
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  users: [],
  initialized: false,
  pending: false,
  error: null,
};

export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialState,
    on(AuthActions.sessionRestored, (state, { user }) => ({ ...state, user, initialized: true })),
    on(AuthActions.login, AuthActions.register, (state) => ({
      ...state,
      pending: true,
      error: null,
    })),
    on(AuthActions.loginSuccess, (state, { user }) => ({
      ...state,
      user,
      pending: false,
      error: null,
    })),
    on(AuthActions.loginFailure, (state, { error }) => ({ ...state, pending: false, error })),
    on(AuthActions.clearError, (state) => ({ ...state, error: null })),
    on(AuthActions.logout, (state) => ({ ...state, user: null, users: [], error: null })),
    on(AuthActions.usersLoaded, (state, { users }) => ({
      ...state,
      users,
      // Если администратор изменил собственную роль — обновляем текущего пользователя.
      user: state.user ? (users.find((u) => u.id === state.user!.id) ?? state.user) : null,
      error: null,
    })),
    on(AuthActions.usersFailure, (state, { error }) => ({ ...state, error })),
  ),
  extraSelectors: ({ selectUser }) => ({
    /** Является ли текущий пользователь администратором. */
    selectIsAdmin: createSelector(selectUser, (user) => user?.role === 'admin'),
    /** Роли текущего пользователя (для плагинной системы). */
    selectRoles: createSelector(selectUser, (user) => (user ? [user.role] : [])),
  }),
});
