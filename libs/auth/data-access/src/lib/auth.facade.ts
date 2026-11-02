// Фасад авторизации: сигналы текущего пользователя и методы входа/выхода для компонентов.
import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { LoginData, RegisterData, UserRole } from '@lingua/shared/models';
import { AuthActions } from './auth.actions';
import { authFeature } from './auth.feature';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly store = inject(Store);

  readonly user = this.store.selectSignal(authFeature.selectUser);
  readonly users = this.store.selectSignal(authFeature.selectUsers);
  readonly isAdmin = this.store.selectSignal(authFeature.selectIsAdmin);
  readonly pending = this.store.selectSignal(authFeature.selectPending);
  readonly error = this.store.selectSignal(authFeature.selectError);
  readonly initialized = this.store.selectSignal(authFeature.selectInitialized);

  login(data: LoginData, returnUrl?: string): void {
    this.store.dispatch(AuthActions.login({ data, returnUrl }));
  }

  register(data: RegisterData): void {
    this.store.dispatch(AuthActions.register({ data }));
  }

  clearError(): void {
    this.store.dispatch(AuthActions.clearError());
  }

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }

  loadUsers(): void {
    this.store.dispatch(AuthActions.loadUsers());
  }

  changeRole(userId: string, role: UserRole): void {
    this.store.dispatch(AuthActions.changeRole({ userId, role }));
  }

  deleteUser(userId: string): void {
    this.store.dispatch(AuthActions.deleteUser({ userId }));
  }
}
