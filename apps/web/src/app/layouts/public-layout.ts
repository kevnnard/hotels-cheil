import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthState } from '../core/auth/auth-state.service';
import { AuthService } from '../core/auth/auth.service';
import { resolveVisitorReturnUrl } from '../core/auth/return-url';
import { HotelCatalogService } from '../features/hotels/data/hotel-catalog.service';
import { formatLocation } from '../features/hotels/data/hotel-location';
import { Hotel } from '../features/hotels/data/hotel.models';
import { SiteFooter } from '../shared/ui/site-footer';

const destinationsPageSize = 100;

function distinctDestinations(hotels: Hotel[]): string[] {
  const locations = hotels.map((hotel) => formatLocation(hotel.address)).filter((location) => location !== '');
  return [...new Set(locations)].sort((first, second) => first.localeCompare(second));
}

@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterOutlet, SiteFooter],
  host: {
    '(document:click)': 'closeMenuOnOutsideClick($event)',
    '(keydown.escape)': 'closeMenuOnEscape()',
  },
  template: `
    <div data-testid="public-layout" class="flex min-h-screen flex-col bg-background">
      <header
        class="fixed top-0 z-50 w-full bg-surface/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl"
      >
        <div
          class="flex w-full flex-wrap items-center justify-between px-margin-mobile md:h-20 md:flex-nowrap md:gap-space-sm md:px-margin-tablet lg:px-margin-desktop"
        >
          <a
            routerLink="/"
            data-testid="brand-link"
            class="inline-flex min-h-11 items-center py-space-sm font-serif text-headline-sm uppercase tracking-widest text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            AUREA
          </a>
          <div
            class="order-last flex w-full items-center justify-between gap-space-sm border-t border-outline-variant/40 md:contents"
          >
            <nav
              aria-label="Main"
              class="flex items-center gap-space-md md:mx-auto md:gap-gutter-desktop"
            >
              <a
                routerLink="/"
                class="inline-flex min-h-11 items-center text-label-lg uppercase text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Home
              </a>
              <a
                routerLink="/"
                fragment="collection"
                class="inline-flex min-h-11 items-center text-label-lg uppercase text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Hotel Collection
              </a>
            </nav>
            <div #accountArea data-testid="header-account" class="relative flex min-w-0 shrink-10 items-center md:order-last">
              @if (session(); as current) {
                <button
                  #accountButton
                  type="button"
                  data-testid="account-menu-button"
                  aria-controls="account-menu"
                  [attr.aria-expanded]="menuOpen()"
                  [attr.aria-label]="'Account menu for ' + current.email"
                  [attr.title]="current.email"
                  class="inline-flex h-11 min-h-11 min-w-0 max-w-44 items-center gap-space-xs rounded-lg px-space-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:max-w-56"
                  (click)="toggleMenu()"
                >
                  <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span data-testid="account-email" class="min-w-0 truncate text-body-sm">{{ current.email }}</span>
                  <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                @if (menuOpen()) {
                  <div
                    id="account-menu"
                    data-testid="account-menu"
                    class="absolute top-full right-0 z-50 mt-space-xs flex w-64 max-w-[calc(100vw-2.5rem)] flex-col gap-space-xs rounded-xl bg-surface-container-lowest p-space-sm shadow-xl"
                  >
                    <p class="px-space-sm pt-space-xs text-label-sm uppercase text-on-surface-variant">Signed in as</p>
                    <p class="break-all px-space-sm pb-space-xs text-body-sm text-on-surface">{{ current.email }}</p>
                    @if (isAdministrator()) {
                      <a
                        routerLink="/admin"
                        data-testid="header-administration"
                        class="inline-flex min-h-11 items-center rounded-lg px-space-sm text-label-lg uppercase text-primary transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Administration
                      </a>
                    }
                    <button
                      type="button"
                      data-testid="header-sign-out"
                      [disabled]="signingOut()"
                      class="inline-flex min-h-11 items-center rounded-lg px-space-sm text-left text-label-lg uppercase text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70"
                      (click)="signOut()"
                    >
                      {{ signingOut() ? 'Signing out…' : 'Sign out' }}
                    </button>
                  </div>
                }
              } @else if (isSettled()) {
                <a
                  #signInLink
                  routerLink="/account/sign-in"
                  data-testid="header-sign-in"
                  [queryParams]="signInQuery()"
                  class="inline-flex min-h-11 items-center whitespace-nowrap px-space-sm text-label-lg uppercase text-primary transition-colors hover:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Sign in
                </a>
              }
            </div>
          </div>
          <div class="flex items-center gap-space-sm">
            <a
              routerLink="/"
              fragment="search-panel"
              data-testid="header-search"
              aria-label="Search hotels"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <svg
                viewBox="0 0 24 24"
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  d="m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </a>
            <a
              routerLink="/"
              fragment="collection"
              class="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg bg-primary-container px-space-sm py-space-sm text-label-lg uppercase text-on-primary sm:px-space-md transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Explore Hotels
            </a>
          </div>
        </div>
      </header>
      <div class="flex-1 pt-(--header-height)">
        <router-outlet />
      </div>
      <app-site-footer [destinations]="destinations()" />
    </div>
  `,
})
export class PublicLayout {
  private readonly catalog = inject(HotelCatalogService);
  private readonly auth = inject(AuthService);
  private readonly authState = inject(AuthState);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly accountArea = viewChild.required<ElementRef<HTMLElement>>('accountArea');
  private readonly accountButton = viewChild<ElementRef<HTMLButtonElement>>('accountButton');
  private readonly signInLink = viewChild<ElementRef<HTMLAnchorElement>>('signInLink');

  private readonly navigationEnds = this.router.events.pipe(filter((event) => event instanceof NavigationEnd));
  private readonly currentUrl = toSignal(this.navigationEnds.pipe(map((event) => event.urlAfterRedirects)), {
    initialValue: this.router.url,
  });

  protected readonly session = this.authState.session;
  protected readonly isSettled = this.authState.isSettled;
  protected readonly isAdministrator = this.authState.isAdministrator;
  protected readonly menuOpen = signal(false);
  protected readonly signingOut = signal(false);
  protected readonly signInQuery = computed(() => {
    const url = this.currentUrl();
    return url !== '/' && resolveVisitorReturnUrl(url) === url ? { returnUrl: url } : {};
  });

  constructor() {
    this.navigationEnds.pipe(takeUntilDestroyed()).subscribe(() => this.menuOpen.set(false));
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenuOnEscape(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.accountButton()?.nativeElement.focus();
    }
  }

  protected closeMenuOnOutsideClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.accountArea().nativeElement.contains(event.target as Node | null)) {
      this.menuOpen.set(false);
    }
  }

  protected signOut(): void {
    if (this.signingOut()) {
      return;
    }
    this.signingOut.set(true);
    this.auth
      .signOut()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => {
          this.signingOut.set(false);
          this.menuOpen.set(false);
          afterNextRender(() => this.signInLink()?.nativeElement.focus(), { injector: this.injector });
        },
      });
  }

  private readonly hotels = rxResource({
    stream: () => this.catalog.list({ name: '', minRating: null, page: 1, pageSize: destinationsPageSize }),
  });

  protected readonly destinations = computed(() =>
    this.hotels.hasValue() ? distinctDestinations(this.hotels.value().items) : [],
  );
}
