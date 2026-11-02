// Маршруты экранов входа и регистрации (доступны только гостям).
import { Routes } from '@angular/router';
import { guestGuard } from '@lingua/auth/data-access';

export const authRoutes: Routes = [
  {
    path: 'login',
    title: 'Вход · LinguaVault',
    canActivate: [guestGuard],
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Регистрация · LinguaVault',
    canActivate: [guestGuard],
    loadComponent: () => import('./register/register.component').then((m) => m.RegisterComponent),
  },
];
