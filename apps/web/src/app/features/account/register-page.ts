import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { resolveVisitorReturnUrl } from '../../core/auth/return-url';
import { LoginField } from '../auth/login-failure';
import {
  accountEmailValidator,
  accountPasswordValidator,
  emailFieldMessage,
  passwordFieldMessage,
  passwordRulesHint,
} from './account-rules';
import { fieldClasses, focusFirstInvalid, returnQuery, visibleError } from './account-form-support';
import { describeRegistrationFailure, signInAfterRegistrationMessage } from './registration-failure';
import { AccountCard } from './ui/account-card';
import { PasswordField } from './ui/password-field';

function matchesPassword(control: AbstractControl): ValidationErrors | null {
  const password: unknown = control.parent?.get('password')?.value;
  return control.value === '' || control.value === password ? null : { mismatch: true };
}

function confirmationMessage(control: AbstractControl): string | null {
  if (control.hasError('required')) {
    return 'Confirm your password.';
  }
  return control.hasError('mismatch') ? 'The passwords do not match.' : null;
}

@Component({
  selector: 'app-register-page',
  imports: [AccountCard, PasswordField, ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.html',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly fieldClasses = fieldClasses;
  protected readonly passwordRulesHint = passwordRulesHint;
  protected readonly returnQuery = returnQuery(this.route.snapshot.queryParamMap);
  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, accountEmailValidator] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, accountPasswordValidator] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, matchesPassword] }),
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  protected emailError(): string | null {
    return visibleError(this.form.controls.email, emailFieldMessage);
  }

  protected passwordError(): string | null {
    return visibleError(this.form.controls.password, passwordFieldMessage);
  }

  protected confirmationError(): string | null {
    return visibleError(this.form.controls.confirmPassword, confirmationMessage);
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
      return;
    }
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    const credentials = { email: email.trim(), password };
    let registered = false;
    this.auth
      .register(credentials)
      .pipe(
        tap(() => (registered = true)),
        switchMap(() => this.auth.signIn(credentials)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(resolveVisitorReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'))),
        error: (error: unknown) => (registered ? this.askToSignIn() : this.showFailure(error)),
      });
  }

  private askToSignIn(): void {
    this.submitting.set(false);
    this.errorMessage.set(signInAfterRegistrationMessage);
  }

  private showFailure(error: unknown): void {
    const failure = describeRegistrationFailure(error);
    const fields: LoginField[] = ['email', 'password'];
    for (const field of fields) {
      const message = failure.fieldErrors[field];
      if (message !== undefined) {
        this.form.controls[field].setErrors({ server: message });
        this.form.controls[field].markAsTouched();
      }
    }
    this.submitting.set(false);
    this.errorMessage.set(failure.message);
    this.focusFirstInvalidField();
  }

  private focusFirstInvalidField(): void {
    focusFirstInvalid(this.host, [
      ['register-email', this.form.controls.email],
      ['register-password', this.form.controls.password],
      ['register-confirm-password', this.form.controls.confirmPassword],
    ]);
  }
}
