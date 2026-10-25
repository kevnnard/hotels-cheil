import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteFooter } from './site-footer';

const fillerLabels = [
  'Experiences',
  'Offers',
  'Gift cards',
  'About us',
  'Careers',
  'Press',
  'Sustainability',
  'Contact',
  'Help centre',
  'Cancellation policy',
  'Privacy policy',
  'Terms of service',
  'Privacy',
  'Terms',
  'Cookies',
];

describe('SiteFooter', () => {
  function render(destinations: string[] = []) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(SiteFooter);
    fixture.componentRef.setInput('destinations', destinations);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, http: TestBed.inject(HttpTestingController) };
  }

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function headings(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('[data-testid="footer-column"] h2')).map((heading) => text(heading));
  }

  function columnItems(element: HTMLElement, heading: string): string[] {
    const column = Array.from(element.querySelectorAll('[data-testid="footer-column"]')).find(
      (candidate) => text(candidate.querySelector('h2')) === heading,
    );
    return Array.from(column?.querySelectorAll('li') ?? []).map((item) => text(item));
  }

  function submitNewsletter(fixture: ReturnType<typeof render>['fixture'], email: string) {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('[data-testid="newsletter-email"]') as HTMLInputElement;
    input.value = email;
    input.dispatchEvent(new Event('input'));
    const event = new Event('submit', { cancelable: true });
    element.querySelector('[data-testid="newsletter-form"]')?.dispatchEvent(event);
    fixture.detectChanges();
    return { input, event };
  }

  it('renders the serif AUREA wordmark with a brand statement', () => {
    const { element } = render();
    const wordmark = element.querySelector('[data-testid="footer-wordmark"]');

    expect(text(wordmark)).toBe('AUREA');
    expect(wordmark?.classList.contains('font-serif')).toBe(true);
    expect(text(element.querySelector('[data-testid="footer-statement"]')).length).toBeGreaterThan(20);
  });

  it('renders four non-navigating social icons', () => {
    const { element } = render();
    const socials = Array.from(element.querySelectorAll<HTMLButtonElement>('[data-testid="footer-social"] button'));

    expect(socials.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Instagram',
      'Facebook',
      'X',
      'LinkedIn',
    ]);
    for (const button of socials) {
      expect(button.type).toBe('button');
      expect(button.hasAttribute('href')).toBe(false);
      expect(button.querySelector('svg')).not.toBeNull();
    }
  });

  it('renders the Explore, Destinations, Company and Support columns', () => {
    const { element } = render(['Lima, Peru']);

    expect(headings(element)).toEqual(['Explore', 'Destinations', 'Company', 'Support']);
    expect(columnItems(element, 'Explore')).toEqual(['Home', 'Hotel Collection', 'Experiences', 'Offers', 'Gift cards']);
    expect(columnItems(element, 'Company')).toEqual(['About us', 'Careers', 'Press', 'Sustainability']);
    expect(columnItems(element, 'Support')).toEqual([
      'Contact',
      'Help centre',
      'Cancellation policy',
      'Privacy policy',
      'Terms of service',
    ]);
  });

  it('renders the destinations it receives in order', () => {
    const { element } = render(['Amalfi, Italy', 'Kyoto, Japan']);

    expect(
      Array.from(element.querySelectorAll('[data-testid="footer-destination"]')).map((item) => text(item)),
    ).toEqual(['Amalfi, Italy', 'Kyoto, Japan']);
  });

  it('renders only the first eight destinations when it receives more', () => {
    const destinations = Array.from({ length: 30 }, (_, index) => `City ${String(index + 1).padStart(2, '0')}, Country`);
    const { element } = render(destinations);

    expect(
      Array.from(element.querySelectorAll('[data-testid="footer-destination"]')).map((item) => text(item)),
    ).toEqual(destinations.slice(0, 8));
  });

  it('renders all destinations when it receives eight', () => {
    const destinations = Array.from({ length: 8 }, (_, index) => `City ${index + 1}, Country`);
    const { element } = render(destinations);

    expect(element.querySelectorAll('[data-testid="footer-destination"]')).toHaveLength(8);
  });

  it('omits the destinations column when there are no destinations', () => {
    const { element } = render([]);

    expect(element.querySelector('[data-testid="footer-destinations"]')).toBeNull();
    expect(headings(element)).toEqual(['Explore', 'Company', 'Support']);
  });

  it('links Home and Hotel Collection through the router and nothing else', () => {
    const { element } = render(['Lima, Peru']);
    const links = Array.from(element.querySelectorAll('a')).map((a) => [text(a), a.getAttribute('href')]);

    expect(links).toEqual([
      ['Home', '/'],
      ['Hotel Collection', '/#collection'],
    ]);
    expect(element.querySelector('a[href="#"]')).toBeNull();
    expect(element.querySelector('a:not([href])')).toBeNull();
  });

  it('renders filler items as non-navigating buttons inside list items', () => {
    const { element } = render();
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('li > button'));
    const labels = buttons.map((button) => text(button));

    expect(labels).toEqual(fillerLabels);
    for (const button of buttons) {
      expect(button.type).toBe('button');
      expect(button.hasAttribute('href')).toBe(false);
      expect(button.classList.contains('text-sm')).toBe(true);
      expect(button.classList.contains('text-on-surface-variant')).toBe(true);
      expect(button.classList.contains('hover:text-on-surface')).toBe(true);
    }
  });

  it('renders the newsletter with a visible label for the email input', () => {
    const { element } = render();
    const newsletter = element.querySelector('[data-testid="footer-newsletter"]') as HTMLElement;
    const input = newsletter.querySelector<HTMLInputElement>('[data-testid="newsletter-email"]') as HTMLInputElement;
    const label = newsletter.querySelector(`label[for="${input.id}"]`);

    expect(text(newsletter.querySelector('h2'))).toBe('Stay in the loop');
    expect(input.type).toBe('email');
    expect(input.id).not.toBe('');
    expect(text(label)).toBe('Email address');
    expect(label?.classList.contains('sr-only')).toBe(false);
    expect(text(newsletter.querySelector('button[type="submit"]'))).toBe('Subscribe');
  });

  it('shows an inline error and no success message for an invalid email', () => {
    const { fixture, element, http } = render();

    const { event } = submitNewsletter(fixture, 'not-an-email');

    expect(event.defaultPrevented).toBe(true);
    expect(text(element.querySelector('[data-testid="newsletter-error"]'))).toBe('Enter a valid email address.');
    expect(element.querySelector('[data-testid="newsletter-success"]')).toBeNull();
    expect(element.querySelector('[data-testid="newsletter-email"]')?.getAttribute('aria-invalid')).toBe('true');
    http.verify();
  });

  it('shows an inline error for an empty email', () => {
    const { fixture, element } = render();

    submitNewsletter(fixture, '');

    expect(element.querySelector('[data-testid="newsletter-error"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="newsletter-success"]')).toBeNull();
  });

  it('confirms a valid email as a demo, clears the field and sends nothing', () => {
    const { fixture, element, http } = render();

    const { input, event } = submitNewsletter(fixture, 'guest@example.com');

    expect(event.defaultPrevented).toBe(true);
    expect(text(element.querySelector('[data-testid="newsletter-success"]'))).toBe('Demo only: nothing was sent.');
    expect(element.querySelector('[data-testid="newsletter-error"]')).toBeNull();
    expect(input.value).toBe('');
    http.verify();
  });

  it('replaces the success message with an error when a later email is invalid', () => {
    const { fixture, element } = render();

    submitNewsletter(fixture, 'guest@example.com');
    submitNewsletter(fixture, 'broken@');

    expect(element.querySelector('[data-testid="newsletter-success"]')).toBeNull();
    expect(element.querySelector('[data-testid="newsletter-error"]')).not.toBeNull();
  });

  it('renders a fictitious contact strip', () => {
    const contact = text(render().element.querySelector('[data-testid="footer-contact"]'));

    expect(contact).toContain('+00 000 000 0000');
    expect(contact).toContain('hello@aurea.example');
    expect(contact).toContain('1 Example Street, Test City');
  });

  it('renders the bottom bar with the fixed copyright and legal filler', () => {
    const bottom = render().element.querySelector('[data-testid="footer-bottom"]') as HTMLElement;

    expect(text(bottom.querySelector('p'))).toBe('© 2026 AUREA Hotels & Resorts. All rights reserved.');
    expect(Array.from(bottom.querySelectorAll('li > button')).map((button) => text(button))).toEqual([
      'Privacy',
      'Terms',
      'Cookies',
    ]);
  });

  it('shows no price, category or amenity text', () => {
    const footerText = text(render(['Lima, Peru']).element);

    for (const forbidden of ['Price', 'Category', 'Amenities', 'Suite', 'Book', 'Reservation', '€', '$']) {
      expect(footerText).not.toContain(forbidden);
    }
  });

  it('stacks on mobile, uses two columns from md and the twelve-column grid from lg', () => {
    const { element } = render(['Lima, Peru']);
    const areas = element.querySelector('[data-testid="footer-areas"]');
    const links = element.querySelector('[data-testid="footer-links"]');
    const bottom = element.querySelector('[data-testid="footer-bottom"]');

    expect(areas?.classList.contains('grid-cols-1')).toBe(true);
    expect(areas?.classList.contains('md:grid-cols-2')).toBe(true);
    expect(areas?.classList.contains('lg:grid-cols-12')).toBe(true);
    expect(links?.classList.contains('grid-cols-2')).toBe(true);
    expect(bottom?.classList.contains('flex-col')).toBe(true);
    expect(bottom?.classList.contains('items-center')).toBe(true);
    expect(bottom?.classList.contains('md:flex-row')).toBe(true);
  });

  it('uses a top border and generous vertical padding', () => {
    const footer = render().element.querySelector('footer');

    for (const token of ['bg-surface-container-low', 'border-t', 'border-outline-variant', 'py-space-lg', 'lg:py-space-xl']) {
      expect(footer?.classList.contains(token), token).toBe(true);
    }
  });

  it('gives every interactive control a touch target of at least 44px', () => {
    const { element } = render(['Lima, Peru']);
    const controls = Array.from(element.querySelectorAll<HTMLElement>('a, button, input'));

    expect(controls.length).toBeGreaterThan(20);
    for (const control of controls) {
      const sized = control.classList.contains('min-h-11') || control.classList.contains('h-11');
      expect(sized, control.outerHTML).toBe(true);
    }
  });

  it('avoids extreme letter spacing in the footer', () => {
    expect(render(['Lima, Peru']).element.querySelector('.tracking-widest')).toBeNull();
  });
});
