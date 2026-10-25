import { Component, computed, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

type NewsletterStatus = 'idle' | 'invalid' | 'sent';

const maximumDestinations = 8;

const footerLinkClass =
  'inline-flex min-h-11 cursor-pointer items-center rounded-lg text-left text-sm text-on-surface-variant underline-offset-4 transition-colors hover:text-on-surface hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low';

@Component({
  selector: 'app-site-footer',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <footer class="border-t border-outline-variant bg-surface-container-low py-space-lg lg:py-space-xl">
      <div class="px-margin-mobile md:px-margin-tablet lg:px-margin-desktop">
        <div class="mx-auto flex max-w-360 flex-col gap-space-lg">
          <div
            data-testid="footer-areas"
            class="grid grid-cols-1 gap-space-lg md:grid-cols-2 md:gap-gutter-desktop lg:grid-cols-12"
          >
            <div class="flex flex-col gap-space-lg lg:col-span-5 lg:pr-space-lg">
              <div class="flex flex-col gap-space-md">
                <span data-testid="footer-wordmark" class="font-serif text-headline-md text-primary">AUREA</span>
                <p data-testid="footer-statement" class="max-w-sm text-body-md text-on-surface-variant">
                  Silent architecture and unhurried hospitality.<br />
                  Refuges designed to outlast everyday memory.
                </p>
                <div data-testid="footer-social" class="flex items-center gap-space-sm">
                  <button type="button" aria-label="Instagram" [class]="socialClass">
                    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" />
                    </svg>
                  </button>
                  <button type="button" aria-label="Facebook" [class]="socialClass">
                    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path
                        d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                  <button type="button" aria-label="X" [class]="socialClass">
                    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path d="M4 4l11.733 16H20L8.267 4z" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M4 20l6.768-6.768m2.46-2.46L20 4" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <button type="button" aria-label="LinkedIn" [class]="socialClass">
                    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path
                        d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <rect x="2" y="9" width="4" height="12" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                  </button>
                </div>
              </div>
              <section
                data-testid="footer-newsletter"
                aria-labelledby="footer-newsletter-heading"
                class="flex max-w-md flex-col gap-space-sm"
              >
                <h2 id="footer-newsletter-heading" class="text-sm font-semibold text-primary">Stay in the loop</h2>
                <p class="text-sm text-on-surface-variant">Seasonal openings and travel notes, a few times a year.</p>
                <form
                  data-testid="newsletter-form"
                  novalidate
                  class="flex flex-col gap-space-xs"
                  [formGroup]="newsletter"
                  (ngSubmit)="subscribe()"
                >
                  <label for="footer-newsletter-email" class="text-sm text-on-surface">Email address</label>
                  <div class="flex flex-col gap-space-sm sm:flex-row">
                    <input
                      id="footer-newsletter-email"
                      data-testid="newsletter-email"
                      type="email"
                      autocomplete="email"
                      placeholder="you@example.com"
                      formControlName="email"
                      [attr.aria-invalid]="status() === 'invalid'"
                      [attr.aria-describedby]="status() === 'invalid' ? 'footer-newsletter-feedback' : null"
                      class="min-h-11 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md text-sm text-on-surface placeholder:text-on-surface-variant/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 aria-invalid:border-error"
                    />
                    <button
                      type="submit"
                      class="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-primary-container px-space-md text-sm font-semibold text-on-primary transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low"
                    >
                      Subscribe
                    </button>
                  </div>
                  <p id="footer-newsletter-feedback" aria-live="polite" class="min-h-5 text-sm">
                    @if (status() === 'invalid') {
                      <span data-testid="newsletter-error" class="text-error">Enter a valid email address.</span>
                    } @else if (status() === 'sent') {
                      <span data-testid="newsletter-success" class="text-primary">Demo only: nothing was sent.</span>
                    }
                  </p>
                </form>
              </section>
            </div>
            <nav
              aria-label="Footer"
              data-testid="footer-links"
              class="grid grid-cols-2 content-start gap-x-gutter gap-y-space-lg lg:col-span-7 xl:grid-cols-4"
            >
              <div data-testid="footer-column" class="flex flex-col gap-space-xs">
                <h2 class="text-sm font-semibold text-primary">Explore</h2>
                <ul class="flex flex-col">
                  <li><a routerLink="/" [class]="linkClass">Home</a></li>
                  <li><a routerLink="/" fragment="collection" [class]="linkClass">Hotel Collection</a></li>
                  @for (label of exploreFiller; track label) {
                    <li><button type="button" [class]="linkClass">{{ label }}</button></li>
                  }
                </ul>
              </div>
              @if (visibleDestinations().length > 0) {
                <div data-testid="footer-column" class="flex flex-col gap-space-xs">
                  <h2 class="text-sm font-semibold text-primary">Destinations</h2>
                  <ul data-testid="footer-destinations" class="flex flex-col">
                    @for (destination of visibleDestinations(); track destination) {
                      <li data-testid="footer-destination" class="flex min-h-11 items-center text-sm text-on-surface-variant">
                        {{ destination }}
                      </li>
                    }
                  </ul>
                </div>
              }
              <div data-testid="footer-column" class="flex flex-col gap-space-xs">
                <h2 class="text-sm font-semibold text-primary">Company</h2>
                <ul class="flex flex-col">
                  @for (label of companyFiller; track label) {
                    <li><button type="button" [class]="linkClass">{{ label }}</button></li>
                  }
                </ul>
              </div>
              <div data-testid="footer-column" class="flex flex-col gap-space-xs">
                <h2 class="text-sm font-semibold text-primary">Support</h2>
                <ul class="flex flex-col">
                  @for (label of supportFiller; track label) {
                    <li><button type="button" [class]="linkClass">{{ label }}</button></li>
                  }
                </ul>
              </div>
            </nav>
          </div>
          <ul
            data-testid="footer-contact"
            class="flex flex-col gap-space-sm border-t border-outline-variant pt-space-md text-sm text-on-surface-variant md:flex-row md:flex-wrap md:items-center md:gap-x-space-lg"
          >
            <li class="flex items-center gap-space-sm">
              <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-primary" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <path
                  d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>+00 000 000 0000</span>
            </li>
            <li class="flex items-center gap-space-sm">
              <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-primary" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>hello&#64;aurea.example</span>
            </li>
            <li class="flex items-center gap-space-sm">
              <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-primary" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>1 Example Street, Test City</span>
            </li>
          </ul>
          <div
            data-testid="footer-bottom"
            class="flex flex-col items-center gap-space-sm border-t border-outline-variant pt-space-md text-center md:flex-row md:justify-between md:text-left"
          >
            <p class="text-sm text-on-surface-variant">© 2026 AUREA Hotels &amp; Resorts. All rights reserved.</p>
            <ul class="flex flex-wrap items-center justify-center gap-x-space-lg">
              @for (label of legalFiller; track label) {
                <li><button type="button" [class]="linkClass">{{ label }}</button></li>
              }
            </ul>
          </div>
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooter {
  readonly destinations = input<string[]>([]);

  protected readonly visibleDestinations = computed(() => this.destinations().slice(0, maximumDestinations));

  protected readonly linkClass = footerLinkClass;
  protected readonly socialClass =
    'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low';
  protected readonly exploreFiller = ['Experiences', 'Offers', 'Gift cards'];
  protected readonly companyFiller = ['About us', 'Careers', 'Press', 'Sustainability'];
  protected readonly supportFiller = ['Contact', 'Help centre', 'Cancellation policy', 'Privacy policy', 'Terms of service'];
  protected readonly legalFiller = ['Privacy', 'Terms', 'Cookies'];

  protected readonly newsletter = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });
  protected readonly status = signal<NewsletterStatus>('idle');

  protected subscribe(): void {
    if (this.newsletter.invalid) {
      this.newsletter.markAllAsTouched();
      this.status.set('invalid');
      return;
    }
    this.newsletter.reset();
    this.status.set('sent');
  }
}
