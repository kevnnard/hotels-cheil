import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthState } from '../../core/auth/auth-state.service';
import { AuthService } from '../../core/auth/auth.service';
import { resolveReturnUrl } from '../../core/auth/return-url';
import { accessDeniedMessage, describeLoginFailure, LoginField } from './login-failure';

const requiredMessages: Record<LoginField, string> = {
  email: 'Enter your email address.',
  password: 'Enter your password.',
};

const fieldOrder: readonly LoginField[] = ['email', 'password'];

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly authState = inject(AuthState);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly emailInput = viewChild.required<ElementRef<HTMLInputElement>>('emailInput');
  private readonly passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly submitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(
    this.route.snapshot.queryParamMap.get('reason') === 'forbidden' ? accessDeniedMessage : null,
  );

  protected fieldError(field: LoginField): string | null {
    const control = this.form.controls[field];
    if (!control.touched || control.valid) {
      return null;
    }
    const server: unknown = control.getError('server');
    if (typeof server === 'string') {
      return server;
    }
    if (control.hasError('required')) {
      return requiredMessages[field];
    }
    return control.hasError('email') ? 'Enter a valid email address.' : null;
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
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
        next: () => this.completeSignIn(),
        error: (error: unknown) => this.showFailure(error),
      });
  }

  private completeSignIn(): void {
    if (this.authState.isAdministrator()) {
      void this.router.navigateByUrl(resolveReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
      return;
    }
    this.auth
      .signOut()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => {
          this.submitting.set(false);
          this.errorMessage.set(accessDeniedMessage);
        },
      });
  }

  private showFailure(error: unknown): void {
    const failure = describeLoginFailure(error);
    for (const field of fieldOrder) {
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
    const inputs: Record<LoginField, ElementRef<HTMLInputElement>> = {
      email: this.emailInput(),
      password: this.passwordInput(),
    };
    const field = fieldOrder.find((name) => this.form.controls[name].invalid);
    if (field !== undefined) {
      inputs[field].nativeElement.focus();
    }
  }
}
