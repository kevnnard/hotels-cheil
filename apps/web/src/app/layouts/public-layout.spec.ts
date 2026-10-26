import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthState } from '../core/auth/auth-state.service';
import { Session } from '../core/auth/session';
import { authInterceptor } from '../core/http/auth.interceptor';
import { Hotel, HotelPage } from '../features/hotels/data/hotel.models';
import { PublicLayout } from './public-layout';

function hotel(id: string, city: string | null, country: string | null): Hotel {
  return {
    id,
    name: `Hotel ${id}`,
    description: null,
    address: { street: null, city, region: null, country, postalCode: null },
    contact: { phone: null, email: null, website: null },
    isActive: true,
    createdAtUtc: '2026-10-01T00:00:00Z',
    updatedAtUtc: '2026-10-01T00:00:00Z',
    rating: { sum: 9, count: 2, average: 4.5 },
    image: null,
    images: [],
    pricing: null,
  };
}

function pageOf(items: Hotel[]): HotelPage {
  return { items, page: 1, pageSize: 100, totalItems: items.length, totalPages: 1 };
}

describe('PublicLayout', () => {
  function mount() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PublicLayout);
    fixture.detectChanges();
    const request = http.expectOne((r) => r.url === '/api/public/hotels');
    return { fixture, request, element: fixture.nativeElement as HTMLElement };
  }

  async function render(hotels: Hotel[] = []) {
    const { fixture, request, element } = mount();
    request.flush(pageOf(hotels));
    await fixture.whenStable();
    fixture.detectChanges();
    return element;
  }

  async function renderFailing() {
    const { fixture, request, element } = mount();
    request.flush('error', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    return element;
  }

  it('shows the wordmark linking to the home', async () => {
    const brand = (await render()).querySelector('[data-testid="brand-link"]');

    expect(brand?.textContent).toContain('AUREA');
    expect(brand?.getAttribute('href')).toBe('/');
  });

  it('keeps the header fixed', async () => {
    expect((await render()).querySelector('header')?.classList.contains('fixed')).toBe(true);
  });

  it('offers the Home and Hotel Collection links and the Explore Hotels action', async () => {
    const header = (await render()).querySelector('header') as HTMLElement;
    const links = Array.from(header.querySelectorAll('a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);

    expect(links).toContainEqual(['Home', '/']);
    expect(links).toContainEqual(['Hotel Collection', '/#collection']);
    expect(links).toContainEqual(['Explore Hotels', '/#collection']);
  });

  it('offers a search control in the header that jumps to the search panel', async () => {
    const search = (await render()).querySelector('header [data-testid="header-search"]');

    expect(search?.getAttribute('aria-label')).toBe('Search hotels');
    expect(search?.getAttribute('href')).toBe('/#search-panel');
  });

  it('links only to screens that exist', async () => {
    const hrefs = Array.from((await render()).querySelectorAll('a')).map((a) => a.getAttribute('href'));

    for (const href of hrefs) {
      expect(['/', '/#collection', '/#search-panel']).toContain(href);
    }
  });

  it('shows only working navigation in the footer', async () => {
    const links = Array.from(((await render()).querySelector('footer') as HTMLElement).querySelectorAll('a')).map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);

    expect(links).toEqual([
      ['Home', '/'],
      ['Hotel Collection', '/#collection'],
    ]);
  });

  it('renders a footer with the wordmark and the rights notice', async () => {
    const footer = (await render()).querySelector('footer');

    expect(footer?.textContent).toContain('AUREA');
    expect(footer?.textContent).toContain('All rights reserved');
  });

  it('shows no unsupported element', async () => {
    const text = (await render()).textContent ?? '';

    for (const forbidden of ['Precio', 'Reservar', 'Calibrar', 'Categoría', 'Maison Privée', 'Suites', 'Amenidades', 'Price', 'Book', 'Reservation', 'Calibrate', 'Category', 'Amenities', 'Suite']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('requests the destinations from the public hotels endpoint with the maximum page size', () => {
    const { request } = mount();

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('pageSize')).toBe('100');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(pageOf([]));
  });

  it('lists the distinct city and country pairs of the hotels in the footer, sorted', async () => {
    const element = (await render([
      hotel('1', 'Lima', 'Peru'),
      hotel('2', 'Kyoto', 'Japan'),
      hotel('3', 'Lima', 'Peru'),
      hotel('4', 'Amalfi', 'Italy'),
    ]));

    const items = Array.from(element.querySelectorAll('footer [data-testid="footer-destination"]')).map((li) =>
      li.textContent?.trim(),
    );
    expect(items).toEqual(['Amalfi, Italy', 'Kyoto, Japan', 'Lima, Peru']);
  });

  it('lists only the first eight sorted destinations when there are thirty hotels', async () => {
    const cities = Array.from({ length: 30 }, (_, index) => `City ${String(index + 1).padStart(2, '0')}`);
    const element = await render([...cities].reverse().map((city, index) => hotel(String(index), city, 'Country')));

    const items = Array.from(element.querySelectorAll('footer [data-testid="footer-destination"]')).map((li) =>
      li.textContent?.trim(),
    );
    expect(items).toEqual(cities.slice(0, 8).map((city) => `${city}, Country`));
  });

  it('lists every destination when there are five hotels', async () => {
    const element = await render(
      ['Lima', 'Kyoto', 'Amalfi', 'Oslo', 'Cusco'].map((city, index) => hotel(String(index), city, 'Country')),
    );

    expect(element.querySelectorAll('footer [data-testid="footer-destination"]')).toHaveLength(5);
  });

  it('skips hotels that have no city and no country', async () => {
    const element = (await render([hotel('1', null, null), hotel('2', null, 'Chile')]));

    const items = Array.from(element.querySelectorAll('footer [data-testid="footer-destination"]')).map((li) =>
      li.textContent?.trim(),
    );
    expect(items).toEqual(['Chile']);
  });

  it('renders no destinations area when there are no hotels', async () => {
    const element = (await render([]));

    expect(element.querySelector('footer [data-testid="footer-destinations"]')).toBeNull();
    expect(element.querySelector('footer')?.textContent).not.toContain('Destinations');
  });

  it('renders no destinations area when the hotels cannot be loaded', async () => {
    const element = await renderFailing();

    expect(element.querySelector('footer [data-testid="footer-destinations"]')).toBeNull();
    expect(element.querySelector('footer')?.textContent).toContain('All rights reserved');
  });

  it('keeps the footer free of prices, categories and amenities, with the newsletter as its only form', async () => {
    const footer = (await render([hotel('1', 'Lima', 'Peru')])).querySelector('footer') as HTMLElement;

    expect(footer.querySelectorAll('form')).toHaveLength(1);
    expect(Array.from(footer.querySelectorAll('input')).map((input) => input.type)).toEqual(['email']);
    expect(footer.querySelector('textarea, select')).toBeNull();
    for (const forbidden of ['Price', 'Category', 'Amenities', '€', '$']) {
      expect(footer.textContent).not.toContain(forbidden);
    }
  });

  it('renders the complete footer sections', async () => {
    const footer = (await render([hotel('1', 'Lima', 'Peru')])).querySelector('footer') as HTMLElement;

    for (const section of ['footer-newsletter', 'footer-social', 'footer-links', 'footer-contact', 'footer-bottom']) {
      expect(footer.querySelector(`[data-testid="${section}"]`), section).not.toBeNull();
    }
    expect(footer.textContent).toContain('Destinations');
  });

  it('sends nothing when the footer newsletter is submitted', async () => {
    const { fixture, request, element } = mount();
    request.flush(pageOf([]));
    await fixture.whenStable();
    fixture.detectChanges();
    const input = element.querySelector<HTMLInputElement>('footer [data-testid="newsletter-email"]') as HTMLInputElement;
    input.value = 'guest@example.com';
    input.dispatchEvent(new Event('input'));
    element.querySelector('footer [data-testid="newsletter-form"]')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(element.querySelector('footer [data-testid="newsletter-success"]')?.textContent).toContain(
      'Demo only: nothing was sent.',
    );
    TestBed.inject(HttpTestingController).verify();
  });

  it('stacks the footer areas on mobile and spreads them from the medium breakpoint', async () => {
    const areas = (await render([hotel('1', 'Lima', 'Peru')])).querySelector('footer [data-testid="footer-areas"]');

    expect(areas?.classList.contains('grid-cols-1')).toBe(true);
    expect(areas?.classList.contains('md:grid-cols-2')).toBe(true);
    expect(areas?.classList.contains('lg:grid-cols-12')).toBe(true);
  });

  it('keeps the main navigation visible on mobile instead of hiding it', async () => {
    const nav = (await render()).querySelector('header nav[aria-label="Main"]') as HTMLElement;

    expect(nav.classList.contains('hidden')).toBe(false);
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim())).toEqual([
      'Home',
      'Hotel Collection',
    ]);
  });

  it('gives every header and footer control a touch target of at least 44px', async () => {
    const element = (await render([hotel('1', 'Lima', 'Peru')]));
    const controls = Array.from(element.querySelectorAll<HTMLElement>('header a, footer a, footer button, footer input'));

    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const sized = control.classList.contains('min-h-11') || control.classList.contains('h-11');
      expect(sized, control.outerHTML).toBe(true);
    }
  });

  it('offsets the page content and anchors by the header height variable', async () => {
    const element = (await render());

    expect(element.querySelector('[data-testid="public-layout"] > div.flex-1')?.className).toContain(
      'pt-(--header-height)',
    );
  });
});

@Component({ template: '<main><h1>Page</h1></main>' })
class ChildPage {}

const visitor: Session = {
  accessToken: 'eyJ.header-token.value',
  email: 'a.very.long.visitor.address@example.com',
  roles: ['User'],
  expiresAtUtc: '2999-01-01T00:00:00Z',
};

const administrator: Session = { ...visitor, email: 'admin@example.com', roles: ['Administrator'] };

describe('PublicLayout account area', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let state: AuthState;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: '',
            component: PublicLayout,
            children: [
              { path: 'hotels/:id', component: ChildPage },
              { path: 'account/sign-in', component: ChildPage },
              { path: '', component: ChildPage },
            ],
          },
          { path: 'admin', component: ChildPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    state = TestBed.inject(AuthState);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionStorage.clear());

  async function open(url: string, session: Session | null = null): Promise<HTMLElement> {
    if (session === null) {
      state.settle();
    } else {
      state.signIn(session);
    }
    await harness.navigateByUrl(url);
    harness.detectChanges();
    for (const request of http.match((candidate) => candidate.url === '/api/public/hotels')) {
      request.flush(pageOf([]));
    }
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.fixture.nativeElement as HTMLElement;
  }

  const header = (root: HTMLElement) => root.querySelector('header') as HTMLElement;
  const find = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`header [data-testid="${id}"]`);

  function openMenu(root: HTMLElement): HTMLButtonElement {
    const button = find(root, 'account-menu-button') as HTMLButtonElement;
    button.click();
    harness.detectChanges();
    return button;
  }

  it('offers an anonymous visitor a Sign in link without a return address on the home', async () => {
    const root = await open('/');

    const link = find(root, 'header-sign-in');
    expect(link?.textContent?.trim()).toBe('Sign in');
    expect(link?.getAttribute('href')).toBe('/account/sign-in');
    expect(link?.className).toContain('min-h-11');
    expect(find(root, 'account-menu-button')).toBeNull();
  });

  it('passes the current address as the return address of the Sign in link', async () => {
    const root = await open('/hotels/abc?tab=2');

    expect(find(root, 'header-sign-in')?.getAttribute('href')).toBe('/account/sign-in?returnUrl=%2Fhotels%2Fabc%3Ftab%3D2');
  });

  it('never makes the sign in page its own return address', async () => {
    const root = await open('/account/sign-in?returnUrl=%2Fhotels%2Fabc');

    expect(find(root, 'header-sign-in')?.getAttribute('href')).toBe('/account/sign-in');
  });

  it('shows the email of a signed in user truncated with its full value as title, and a closed menu', async () => {
    const root = await open('/', visitor);

    const button = find(root, 'account-menu-button') as HTMLButtonElement;
    const email = find(root, 'account-email') as HTMLElement;
    expect(find(root, 'header-sign-in')).toBeNull();
    expect(email.textContent?.trim()).toBe(visitor.email);
    expect(email.className).toContain('truncate');
    expect(button.getAttribute('title')).toBe(visitor.email);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe(`Account menu for ${visitor.email}`);
    expect(find(root, 'account-menu')).toBeNull();
  });

  it('opens the menu with Sign out and no Administration link for a user', async () => {
    const root = await open('/', visitor);

    const button = openMenu(root);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe('account-menu');
    expect(find(root, 'account-menu')?.id).toBe('account-menu');
    expect(find(root, 'header-sign-out')?.textContent?.trim()).toBe('Sign out');
    expect(find(root, 'header-administration')).toBeNull();
  });

  it('adds the Administration link for an administrator', async () => {
    const root = await open('/', administrator);

    openMenu(root);

    const link = find(root, 'header-administration');
    expect(link?.textContent?.trim()).toBe('Administration');
    expect(link?.getAttribute('href')).toBe('/admin');
  });

  it('signs out, clears the session and stays on the same page', async () => {
    const root = await open('/hotels/abc', visitor);
    openMenu(root);
    const navigate = vi.spyOn(router, 'navigate');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

    (find(root, 'header-sign-out') as HTMLButtonElement).click();
    harness.detectChanges();
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.headers.get('Authorization')).toBe(`Bearer ${visitor.accessToken}`);
    logout.flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(state.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/hotels/abc');
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(find(root, 'header-sign-in')).not.toBeNull();
    expect(find(root, 'account-menu-button')).toBeNull();
  });

  it('closes the menu with Escape and returns the focus to its button', async () => {
    const root = await open('/', visitor);
    const button = openMenu(root);
    (find(root, 'header-sign-out') as HTMLButtonElement).focus();

    find(root, 'account-menu')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    harness.detectChanges();

    expect(find(root, 'account-menu')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('closes the menu on a click outside it and on navigation', async () => {
    const root = await open('/', administrator);
    openMenu(root);

    document.body.click();
    harness.detectChanges();
    expect(find(root, 'account-menu')).toBeNull();

    openMenu(root);
    (find(root, 'header-administration') as HTMLAnchorElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/admin');
  });

  it('keeps every header control at least 44 px tall in every state', async () => {
    for (const session of [null, administrator]) {
      const root = await open('/', session);
      if (session !== null) {
        openMenu(root);
      }
      for (const control of Array.from(header(root).querySelectorAll<HTMLElement>('a, button'))) {
        expect(control.className, control.outerHTML).toMatch(/min-h-11|h-11/);
      }
    }
  });

  it('keeps the main navigation links unchanged in every state', async () => {
    const root = await open('/', visitor);

    const nav = header(root).querySelector('nav[aria-label="Main"]') as HTMLElement;
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim())).toEqual(['Home', 'Hotel Collection']);
    expect(root.querySelectorAll('h1').length).toBe(1);
    expect(root.innerHTML).not.toContain(visitor.accessToken);
  });
});
