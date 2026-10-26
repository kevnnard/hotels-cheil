import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { resolveVisitorReturnUrl } from '../../core/auth/return-url';
import { describeLoginFailure, LoginField } from '../auth/login-failure';
import { accountEmailValidator, emailFieldMessage } from './account-rules';
import { fieldClasses, focusFirstInvalid, returnQuery, visibleError } from './account-form-support';
import { AccountCard } from './ui/account-card';
import { PasswordField } from './ui/password-field';

function passwordMessage(control: AbstractControl): string | null {
  const server: unknown = control.getError('server');
  if (typeof server === 'string') {
    return server;
  }
  return control.hasError('required') ? 'Enter your password.' : null;
}

@Component({
  selector: 'app-sign-in-page',
  imports: [AccountCard, PasswordField, ReactiveFormsModule, RouterLink],
  templateUrl: './sign-in-page.html',
})
export class SignInPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly fieldClasses = fieldClasses;
  protected readonly returnQuery = returnQuery(this.route.snapshot.queryParamMap);
  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, accountEmailValidator] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected emailError(): string | null {
    return visibleError(this.form.controls.email, emailFieldMessage);
  }

  protected passwordError(): string | null {
    return visibleError(this.form.controls.password, passwordMessage);
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
    this.auth
      .signIn({ email: email.trim(), password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigateByUrl(resolveVisitorReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'))),
        error: (error: unknown) => this.showFailure(error),
      });
  }

  private showFailure(error: unknown): void {
    const failure = describeLoginFailure(error);
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
      ['sign-in-email', this.form.controls.email],
      ['sign-in-password', this.form.controls.password],
    ]);
  }
}
