// Экран входа: email и пароль, ошибки сервера, переход к регистрации.
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthFacade, DEFAULT_ADMIN } from '@lingua/auth/data-access';

@Component({
  selector: 'lv-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: '../auth-page.scss',
})
export class LoginComponent {
  readonly auth = inject(AuthFacade);

  constructor() {
    // Ошибка с другой формы не должна показываться здесь.
    this.auth.clearError();
  }
  /** Куда вернуться после входа (query-параметр `returnUrl`). */
  readonly returnUrl = input<string>();
  /** Показывать ли пароль. */
  readonly showPassword = signal(false);
  /** Данные демо-администратора для подсказки. */
  readonly demo = DEFAULT_ADMIN;

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** Отправка формы. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.auth.login(this.form.getRawValue(), this.returnUrl());
  }

  /** Подставляет данные демо-администратора. */
  fillDemo(): void {
    this.form.setValue({ email: this.demo.email, password: this.demo.password });
  }
}
