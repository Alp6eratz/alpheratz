// Экран регистрации: имя, email, пароль с подтверждением и выбор роли.
// Для роли администратора требуется код приглашения.
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { AuthFacade } from '@lingua/auth/data-access';
import { UserRole } from '@lingua/shared/models';

/** Проверка совпадения пароля и подтверждения. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'lv-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: '../auth-page.scss',
})
export class RegisterComponent {
  readonly auth = inject(AuthFacade);

  constructor() {
    // Ошибка с другой формы не должна показываться здесь.
    this.auth.clearError();
  }
  readonly showPassword = signal(false);

  readonly form = inject(NonNullableFormBuilder).group(
    {
      name: ['', [Validators.required, Validators.maxLength(60)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', [Validators.required]],
      role: ['student' as UserRole],
      inviteCode: [''],
    },
    { validators: passwordsMatch },
  );

  /** Выбранная роль (для показа поля кода приглашения). */
  readonly role = toSignal(this.form.controls.role.valueChanges, {
    initialValue: 'student' as UserRole,
  });

  /** Отправка формы. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, password, role, inviteCode } = this.form.getRawValue();
    this.auth.register({ name, email, password, role, inviteCode });
  }
}
