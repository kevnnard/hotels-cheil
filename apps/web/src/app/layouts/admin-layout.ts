import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IsActiveMatchOptions, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthState } from '../core/auth/auth-state.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div data-testid="admin-layout" class="min-h-screen bg-background">
      <header
        class="sticky top-0 z-40 bg-surface/95 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:bg-surface-container-low lg:shadow-none"
      >
        <div
          class="flex flex-wrap items-center gap-x-gutter px-margin-mobile md:px-margin-tablet lg:h-full lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-space-lg lg:px-space-lg lg:py-space-lg"
        >
          <a
            routerLink="/admin"
            class="inline-flex min-h-11 flex-col justify-center py-space-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span class="font-serif text-headline-sm uppercase tracking-widest text-primary">AUREA</span>
            <span class="text-label-sm uppercase text-on-surface-variant">Administration</span>
          </a>
          <nav
            aria-label="Administration"
            class="order-last flex w-full items-center gap-gutter border-t border-outline-variant/40 lg:order-none lg:flex-col lg:items-stretch lg:gap-space-xs lg:border-t-0"
          >
            <a
              routerLink="/admin"
              routerLinkActive="text-primary lg:bg-surface-container-lowest lg:shadow-sm"
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="hotelsLinkActiveOptions"
              class="inline-flex min-h-11 items-center text-label-lg uppercase text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:rounded-lg lg:px-space-md"
            >
              Hotels
            </a>
            <a
              routerLink="/"
              class="inline-flex min-h-11 items-center text-label-lg uppercase text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:rounded-lg lg:px-space-md"
            >
              View public site
            </a>
          </nav>
          <div
            class="ml-auto flex min-w-0 items-center gap-space-sm lg:mt-auto lg:ml-0 lg:flex-col lg:items-stretch lg:gap-space-sm"
          >
            <span
              data-testid="admin-email"
              class="max-w-36 truncate text-body-sm text-on-surface-variant sm:max-w-56 lg:max-w-none"
              [attr.title]="email()"
            >{{ email() }}</span>
            <button
              type="button"
              data-testid="admin-sign-out"
              [disabled]="signingOut()"
              class="inline-flex min-h-11 items-center justify-center rounded-lg bg-surface-container-lowest px-space-md text-label-lg uppercase text-on-surface shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70"
              (click)="signOut()"
            >
              {{ signingOut() ? 'Signing out…' : 'Sign out' }}
            </button>
          </div>
        </div>
      </header>
      <main class="px-margin-mobile py-space-lg md:px-margin-tablet lg:ml-64 lg:px-margin-desktop lg:py-space-xl">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly email = inject(AuthState).email;
  protected readonly hotelsLinkActiveOptions: IsActiveMatchOptions = {
    paths: 'subset',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };
  protected readonly signingOut = signal(false);

  protected signOut(): void {
    if (this.signingOut()) {
      return;
    }
    this.signingOut.set(true);
    this.auth
      .signOut()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ complete: () => void this.router.navigateByUrl('/admin/login') });
  }
}
