import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthState } from '../../core/auth/auth-state.service';
import { Session } from '../../core/auth/session';
import { Hotel } from '../hotels/data/hotel.models';
import { AdminDirectoryRefresh } from './data/admin-directory-refresh';
import { HotelSheetPage } from './hotel-sheet-page';
import { installDialogStub, removeDialogStub } from './ui/dialog-test-support';

@Component({
  imports: [RouterOutlet],
  template: '<h1>Hotels</h1><router-outlet />',
})
class DirectoryStub {}

const stored: Hotel = {
  id: 'h1',
  name: 'Aurea Cliff',
  description: null,
  address: { street: null, city: 'Positano', region: null, country: 'Italy', postalCode: null },
  contact: { phone: null, email: null, website: null },
  isActive: true,
  createdAtUtc: '2026-10-01T00:00:00Z',
  updatedAtUtc: '2026-10-01T00:00:00Z',
  rating: { sum: 9, count: 2, average: 4.5 },
  image: null,
  images: [{ position: 0, contentType: 'image/webp', width: 800, height: 600, sizeBytes: 1000 }],
  pricing: { currency: 'USD', nightlyRate: 400, discountPercent: 25, discountedNightlyRate: 300 },
};

const administrator: Session = {
  accessToken: 'eyJ.admin-sheet-token.value',
  email: 'admin@example.com',
  roles: ['Administrator'],
  expiresAtUtc: '2999-01-01T00:00:00Z',
};

const emptyBody = {
  name: 'Aurea Cliff',
  description: null,
  street: null,
  city: null,
  region: null,
  country: null,
  postalCode: null,
  phone: null,
  email: null,
  website: null,
  pricePerNight: null,
  discountPercent: null,
};

describe('HotelSheetPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let refresh: AdminDirectoryRefresh;

  beforeEach(async () => {
    sessionStorage.clear();
    installDialogStub();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'admin',
            component: DirectoryStub,
            children: [
              { path: 'hotels/new', component: HotelSheetPage },
              { path: 'hotels/:id/edit', component: HotelSheetPage },
            ],
          },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    refresh = TestBed.inject(AdminDirectoryRefresh);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    removeDialogStub();
    document.body.classList.remove('overflow-hidden');
    document.body.replaceChildren();
  });

  const root = () => harness.routeNativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(id: string) => root().querySelector<T>(`[data-testid="${id}"]`);
  const field = (name: string) => find<HTMLInputElement>(`hotel-field-${name}`) as HTMLInputElement;
  const alertText = () => find('hotel-form-alert')?.textContent?.replace(/\s+/g, ' ').trim();

  async function settle() {
    for (let round = 0; round < 3; round += 1) {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
    }
  }

  async function open(url: string) {
    await harness.navigateByUrl(url);
    document.body.appendChild(harness.fixture.nativeElement as HTMLElement);
    await settle();
  }

  async function openEdit(hotel: Hotel = stored, url = `/admin/hotels/${hotel.id}/edit?name=sea`) {
    await open(url);
    http.expectOne((r) => r.method === 'GET' && r.url === `/api/hotels/${hotel.id}`).flush(hotel);
    await settle();
  }

  async function type(name: string, value: string) {
    const input = field(name);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function submit() {
    find('hotel-form-submit')?.click();
    await settle();
  }

  async function choose(position: number, file: File) {
    const input = find<HTMLInputElement>(`image-slot-${position}-input`) as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await settle();
  }

  function expectPost(): TestRequest {
    return http.expectOne((r) => r.method === 'POST' && r.url === '/api/hotels');
  }

  describe('create', () => {
    it('opens an empty form without loading anything and keeps one h1', async () => {
      await open('/admin/hotels/new?name=sea');

      expect(find('admin-sheet')?.querySelector('h2')?.textContent?.trim()).toBe('New hotel');
      expect(field('name').value).toBe('');
      expect(root().querySelectorAll('h1').length).toBe(1);
      expect(find('hotel-ratings')).toBeNull();
      http.expectNone((r) => r.method === 'GET');
    });

    it('posts the exact body, closes to the directory with the query and announces Hotel created.', async () => {
      await open('/admin/hotels/new?name=sea');
      await type('name', 'Aurea Cliff');

      await submit();
      const request = expectPost();
      expect(request.request.body).toEqual(emptyBody);
      request.flush({ ...stored, images: [] }, { status: 201, statusText: 'Created' });
      await settle();

      expect(router.url).toBe('/admin?name=sea');
      expect(find('admin-sheet')).toBeNull();
      expect(refresh.change()).toEqual({ message: 'Hotel created.', sequence: 1 });
    });

    it('blocks a second submit while the first is saving', async () => {
      await open('/admin/hotels/new');
      await type('name', 'Aurea Cliff');

      await submit();
      expect((find<HTMLButtonElement>('hotel-form-submit') as HTMLButtonElement).disabled).toBe(true);
      (find('hotel-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await settle();

      expectPost().flush({ ...stored, images: [] }, { status: 201, statusText: 'Created' });
      await settle();
    });

    it('maps the validation keys to the fields, keeps unknown ones in the alert and stays open', async () => {
      await open('/admin/hotels/new?name=sea');
      await type('name', 'Aurea Cliff');
      await type('pricePerNight', '100');

      await submit();
      expectPost().flush(
        { status: 400, errors: { PricePerNight: ['Price per night cannot exceed 100000.'], request: ['Email is not valid.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
      await settle();

      expect(router.url).toBe('/admin/hotels/new?name=sea');
      expect(find('hotel-field-pricePerNight-error')?.textContent?.trim()).toBe('Price per night cannot exceed 100000.');
      expect(alertText()).toContain('Check the highlighted fields and try again.');
      expect(alertText()).toContain('Email is not valid.');
      expect(document.activeElement).toBe(field('pricePerNight'));
      expect((find<HTMLButtonElement>('hotel-form-submit') as HTMLButtonElement).disabled).toBe(false);
      expect(refresh.change()).toBeNull();
    });

    it('explains a 403', async () => {
      await open('/admin/hotels/new');
      await type('name', 'Aurea Cliff');

      await submit();
      expectPost().flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();

      expect(alertText()).toBe('You do not have permission to do this.');
      expect(find('hotel-form-retry')).toBeNull();
    });

    it('offers a retry after a network failure that posts once more', async () => {
      await open('/admin/hotels/new');
      await type('name', 'Aurea Cliff');

      await submit();
      expectPost().error(new ProgressEvent('error'), { status: 0 });
      await settle();
      expect(alertText()).toContain('We could not reach the server. Check your connection and try again.');

      find('hotel-form-retry')?.click();
      await settle();
      expectPost().flush({ ...stored, images: [] }, { status: 201, statusText: 'Created' });
      await settle();

      expect(router.url).toBe('/admin');
    });

    it('uploads the chosen images in order after the POST and closes when all of them succeed', async () => {
      await open('/admin/hotels/new');
      await type('name', 'Aurea Cliff');
      await choose(2, new File(['b'], 'pool.png', { type: 'image/png' }));
      await choose(0, new File(['a'], 'front.jpg', { type: 'image/jpeg' }));

      await submit();
      http.expectNone((r) => r.url.includes('/images/'));
      expectPost().flush({ ...stored, id: 'n1', images: [] }, { status: 201, statusText: 'Created' });
      await settle();

      const first = http.expectOne('/api/hotels/n1/images/0');
      expect(((first.request.body as FormData).get('image') as File).name).toBe('front.jpg');
      http.expectNone('/api/hotels/n1/images/2');
      first.flush({ contentType: 'image/jpeg', width: 1, height: 1, sizeBytes: 1 });
      await settle();
      http.expectOne('/api/hotels/n1/images/2').flush({ contentType: 'image/png', width: 1, height: 1, sizeBytes: 1 });
      await settle();

      expect(router.url).toBe('/admin');
      expect(refresh.change()?.message).toBe('Hotel created.');
    });

    it('lands on the edit route of the created hotel naming the failed slots and never posts again', async () => {
      await open('/admin/hotels/new?name=sea');
      await type('name', 'Aurea Cliff');
      await choose(0, new File(['a'], 'front.jpg', { type: 'image/jpeg' }));
      await choose(2, new File(['b'], 'pool.png', { type: 'image/png' }));

      await submit();
      expectPost().flush({ ...stored, id: 'n1', images: [] }, { status: 201, statusText: 'Created' });
      await settle();
      http.expectOne('/api/hotels/n1/images/0').flush({ title: 'Only static JPEG, PNG and WebP images are accepted.' }, { status: 415, statusText: 'Unsupported' });
      await settle();
      http.expectOne('/api/hotels/n1/images/2').flush({ contentType: 'image/png', width: 1, height: 1, sizeBytes: 1 });
      await settle();

      expect(router.url).toBe('/admin/hotels/n1/edit?name=sea');
      expect(refresh.change()?.message).toBe('Hotel created.');
      http.expectOne('/api/hotels/n1').flush({ ...stored, id: 'n1', images: [{ position: 2, contentType: 'image/png', width: 1, height: 1, sizeBytes: 1 }] });
      await settle();

      expect(alertText()).toBe('Hotel created, but these images could not be uploaded: main image. Upload them again below.');
      expect(find('admin-sheet')?.querySelector('h2')?.textContent?.trim()).toBe('Edit hotel');

      await submit();
      http.expectNone((r) => r.method === 'POST');
      http.expectOne((r) => r.method === 'PUT' && r.url === '/api/hotels/n1').flush({ ...stored, id: 'n1' });
      await settle();
      expect(router.url).toBe('/admin?name=sea');
    });

    it('refuses a file the API would not accept before sending it', async () => {
      await open('/admin/hotels/new');

      await choose(1, new File(['g'], 'anim.gif', { type: 'image/gif' }));

      expect(find('image-slot-1-error')?.textContent?.trim()).toBe('Choose a JPEG, PNG or WebP image.');
      expect(find('image-slot-1-file')).toBeNull();
    });

    it('asks before discarding picked images of a new hotel', async () => {
      await open('/admin/hotels/new');
      await choose(0, new File(['a'], 'front.jpg', { type: 'image/jpeg' }));

      find('sheet-close')?.click();
      await settle();

      expect(find('sheet-discard-confirmation')).not.toBeNull();
    });
  });

  describe('edit', () => {
    it('shows a loading state, then every stored value and the rating summary', async () => {
      await open('/admin/hotels/h1/edit');

      expect(find('hotel-sheet-loading')?.getAttribute('aria-busy')).toBe('true');
      expect(find('hotel-form')).toBeNull();
      http.expectOne('/api/hotels/h1').flush(stored);
      await settle();

      expect(find('hotel-sheet-loading')).toBeNull();
      expect(field('name').value).toBe('Aurea Cliff');
      expect(field('city').value).toBe('Positano');
      expect(field('street').value).toBe('');
      expect(field('pricePerNight').value).toBe('400');
      expect(field('discountPercent').value).toBe('25');
      const ratings = find('hotel-ratings') as HTMLElement;
      expect(ratings.textContent).toContain('4.50');
      expect(ratings.textContent).toContain('2 ratings');
      expect(ratings.querySelector('input, select')).toBeNull();
      expect(root().querySelectorAll('h1').length).toBe(1);
    });

    it('says when a hotel has no ratings yet', async () => {
      await openEdit({ ...stored, rating: { sum: 0, count: 0, average: null } });

      expect(find('hotel-ratings')?.textContent).toContain('No ratings yet.');
    });

    it('puts the full replacement with nulls, closes keeping the query and announces Hotel saved.', async () => {
      await openEdit();
      await type('city', 'Amalfi');
      await type('pricePerNight', '');

      await submit();
      const request = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/hotels/h1');
      expect(request.request.body).toEqual({ ...emptyBody, city: 'Amalfi', country: 'Italy' });
      request.flush({ ...stored, address: { ...stored.address, city: 'Amalfi' } });
      await settle();

      expect(router.url).toBe('/admin?name=sea');
      expect(find('sheet-discard-confirmation')).toBeNull();
      expect(find('admin-sheet')).toBeNull();
      expect(refresh.change()?.message).toBe('Hotel saved.');
    });

    it('asks before discarding a modified form', async () => {
      await openEdit();
      await type('city', 'Amalfi');

      find('sheet-close')?.click();
      await settle();

      expect(find('sheet-discard-confirmation')?.textContent).toContain('Discard your changes?');
      expect(router.url).toBe('/admin/hotels/h1/edit?name=sea');
    });

    it('closes an unchanged form at once with Cancel', async () => {
      await openEdit();

      find('hotel-form-cancel')?.click();
      await settle();

      expect(router.url).toBe('/admin?name=sea');
    });

    it('shows a not found state with a link back to the directory', async () => {
      await open('/admin/hotels/gone/edit?name=sea');
      http.expectOne('/api/hotels/gone').flush({ title: 'The hotel does not exist.' }, { status: 404, statusText: 'Not Found' });
      await settle();

      const notFound = find('hotel-sheet-not-found') as HTMLElement;
      expect(notFound.textContent).toContain('This hotel does not exist or was deleted.');
      expect(notFound.querySelector('a')?.getAttribute('href')).toBe('/admin?name=sea');
      expect(find('hotel-form')).toBeNull();
    });

    it('shows a load error with a retry that requests the hotel again', async () => {
      await open('/admin/hotels/h1/edit');
      http.expectOne('/api/hotels/h1').flush(null, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(find('hotel-sheet-error')?.textContent).toContain('We could not load this hotel');
      find('hotel-sheet-retry')?.click();
      await settle();
      http.expectOne('/api/hotels/h1').flush(stored);
      await settle();

      expect(field('name').value).toBe('Aurea Cliff');
    });

    it('explains a hotel deleted while editing', async () => {
      await openEdit();

      await submit();
      http.expectOne((r) => r.method === 'PUT').flush({ title: 'The hotel does not exist.' }, { status: 404, statusText: 'Not Found' });
      await settle();

      expect(alertText()).toBe('This hotel no longer exists.');
      expect(router.url).toBe('/admin/hotels/h1/edit?name=sea');
    });
  });

  describe('images in edit', () => {
    it('shows the three slots with the stored image', async () => {
      await openEdit();

      expect(find('image-slot-0')?.querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/h1/images/0');
      expect(find('image-slot-1')?.querySelector('[data-testid="image-placeholder"]')).not.toBeNull();
    });

    it('uploads at once to the slot position as the field image and refreshes the slot without dirtying the form', async () => {
      await openEdit();

      await choose(1, new File(['x'], 'pool.webp', { type: 'image/webp' }));
      const request = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/hotels/h1/images/1');
      expect([...(request.request.body as FormData).keys()]).toEqual(['image']);
      expect(find('image-slot-1-upload')?.textContent?.trim()).toBe('Uploading…');
      request.flush({ contentType: 'image/webp', width: 800, height: 600, sizeBytes: 1000 });
      await settle();

      expect(find('image-slot-1')?.querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/h1/images/1?v=1');
      expect(find('image-slot-1-status')?.textContent?.trim()).toBe('Image uploaded.');
      find('sheet-close')?.click();
      await settle();
      expect(find('sheet-discard-confirmation')).toBeNull();
      expect(router.url).toBe('/admin?name=sea');
    });

    it.each([
      [400, { errors: { image: ['The image is empty.'] } }, 'The image is empty.'],
      [413, { title: 'The image exceeds 10485760 bytes.' }, 'The image exceeds 10485760 bytes.'],
      [415, { title: 'Animated images are not accepted.' }, 'Animated images are not accepted.'],
      [422, { title: 'The image cannot be stored within 400000 bytes.' }, 'The image cannot be stored within 400000 bytes.'],
    ])('shows the API message of a %s upload in the slot alert', async (status, body, message) => {
      await openEdit();

      await choose(2, new File(['x'], 'pool.png', { type: 'image/png' }));
      http.expectOne('/api/hotels/h1/images/2').flush(body, { status, statusText: 'Rejected' });
      await settle();

      expect(find('image-slot-2-error')?.textContent?.trim()).toBe(message);
      expect(find('image-slot-2')?.querySelector('img')).toBeNull();
      expect(find('image-slot-2-upload')?.textContent?.trim()).toBe('Upload');
    });

    it('removes an image after the inline confirmation', async () => {
      await openEdit();

      find('image-slot-0-remove')?.click();
      await settle();
      http.expectNone((r) => r.method === 'DELETE');
      find('image-slot-0-confirm-remove')?.click();
      await settle();
      http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/hotels/h1/images/0').flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(find('image-slot-0')?.querySelector('img')).toBeNull();
      expect(find('image-slot-0-remove')).toBeNull();
      expect(find('image-slot-0-status')?.textContent?.trim()).toBe('Image removed.');
    });

    it('keeps the image and explains a failed removal', async () => {
      await openEdit();

      find('image-slot-0-remove')?.click();
      await settle();
      find('image-slot-0-confirm-remove')?.click();
      await settle();
      http.expectOne((r) => r.method === 'DELETE').flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();

      expect(find('image-slot-0-error')?.textContent?.trim()).toBe('You do not have permission to do this.');
      expect(find('image-slot-0')?.querySelector('img')).not.toBeNull();
    });
  });

  describe('ratings in edit', () => {
    const ratings = () => find('hotel-ratings') as HTMLElement;
    const inRatings = (id: string) => ratings().querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const ratingsText = (id: string) => inRatings(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const stars = () => Array.from(ratings().querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const checked = () => stars().map((star) => star.getAttribute('aria-checked'));

    function signIn() {
      TestBed.inject(AuthState).signIn(administrator);
    }

    function ownScoreRequest(): TestRequest {
      return http.expectOne((r) => r.method === 'GET' && r.url === '/api/hotels/h1/ratings/me');
    }

    async function openRating(score: number | null, hotel: Hotel = stored) {
      signIn();
      await openEdit(hotel);
      ownScoreRequest().flush({ score });
      await settle();
    }

    async function rate(value: number): Promise<TestRequest> {
      stars()[value - 1].click();
      await settle();
      return http.expectOne((r) => r.method === 'POST' && r.url === '/api/hotels/h1/ratings');
    }

    async function expectCleanClose() {
      find('sheet-close')?.click();
      await settle();
      expect(find('sheet-discard-confirmation')).toBeNull();
      expect(router.url).toBe('/admin?name=sea');
    }

    it('loads the own vote of the administrator, checks its star and explains it is their own vote', async () => {
      signIn();
      await openEdit();

      expect(inRatings('own-rating-loading')?.getAttribute('aria-busy')).toBe('true');
      ownScoreRequest().flush({ score: 3 });
      await settle();

      expect(inRatings('own-rating-loading')).toBeNull();
      expect(checked()).toEqual(['false', 'false', 'true', 'false', 'false']);
      expect(ratingsText('rating-control-value')).toBe('3 of 5');
      expect(ratings().textContent).toContain('Your rating');
      expect(ratingsText('rating-summary')).toContain('4.50');
      expect(ratingsText('rating-summary')).toContain('2 ratings');
      expect(ratingsText('hotel-ratings-note')).toBe(
        'Your stars are your own vote as an administrator. Guest votes are included in the average.',
      );
    });

    it('checks no star when the administrator has not rated the hotel', async () => {
      await openRating(null);

      expect(checked()).toEqual(['false', 'false', 'false', 'false', 'false']);
      expect(ratingsText('rating-control-value')).toBe('Not rated yet');
    });

    it('saves a rating, thanks, updates the summary without reloading the hotel and keeps the form clean', async () => {
      await openRating(null);

      const request = await rate(4);
      expect(request.request.body).toEqual({ score: 4 });
      expect(ratings().querySelector('[role="radiogroup"]')?.getAttribute('aria-busy')).toBe('true');
      request.flush({ sum: 13, count: 3, average: 4.33 });
      await settle();

      expect(ratingsText('rating-status')).toBe('Thanks, your rating was saved.');
      expect(inRatings('rating-status')?.getAttribute('role')).toBe('status');
      expect(ratingsText('rating-summary')).toContain('4.33');
      expect(ratingsText('rating-summary')).toContain('3 ratings');
      expect(ratingsText('rating-control-value')).toBe('4 of 5');
      expect(field('name').value).toBe('Aurea Cliff');
      expect(field('city').value).toBe('Positano');
      http.expectNone((r) => r.method === 'GET' && r.url === '/api/hotels/h1');
      expect(refresh.change()).toEqual({ message: null, sequence: 1 });
      await expectCleanClose();
    });

    it('replaces the vote and updates the summary again', async () => {
      await openRating(4);

      (await rate(2)).flush({ sum: 7, count: 2, average: 3.5 });
      await settle();

      expect(ratingsText('rating-summary')).toContain('3.50');
      expect(ratingsText('rating-summary')).toContain('2 ratings');
      expect(ratingsText('rating-control-value')).toBe('2 of 5');
      expect(checked()).toEqual(['false', 'true', 'false', 'false', 'false']);
    });

    it('replaces No ratings yet with the summary after the first rating', async () => {
      await openRating(null, { ...stored, rating: { sum: 0, count: 0, average: null } });
      expect(ratings().textContent).toContain('No ratings yet.');

      (await rate(5)).flush({ sum: 5, count: 1, average: 5 });
      await settle();

      expect(ratings().textContent).not.toContain('No ratings yet.');
      expect(ratingsText('rating-summary')).toContain('5.00');
      expect(ratingsText('rating-summary')).toContain('1 rating');
    });

    it('ignores a second selection while the first one is saving', async () => {
      await openRating(null);

      stars()[2].click();
      stars()[4].click();
      await settle();
      stars()[3].click();
      await settle();

      const requests = http.match((r) => r.method === 'POST' && r.url === '/api/hotels/h1/ratings');
      expect(requests.length).toBe(1);
      expect(requests[0].request.body).toEqual({ score: 3 });
      requests[0].flush({ sum: 12, count: 3, average: 4 });
      await settle();
      expect(refresh.change()?.sequence).toBe(1);
    });

    it.each([
      [400, 'The rating must be between 1 and 5.'],
      [401, 'Your session has expired. Sign in again.'],
      [403, 'You do not have permission to rate.'],
      [404, 'This hotel no longer exists.'],
      [500, 'Could not save your rating. Try again.'],
    ])('explains a %s in an alert and keeps the previous vote and summary', async (status, message) => {
      await openRating(3);

      (await rate(5)).flush(null, { status, statusText: 'Failure' });
      await settle();

      expect(ratingsText('rating-error')).toBe(message);
      expect(inRatings('rating-error')?.getAttribute('role')).toBe('alert');
      expect(ratingsText('rating-status')).toBe('');
      expect(ratingsText('rating-control-value')).toBe('3 of 5');
      expect(ratingsText('rating-summary')).toContain('4.50');
      expect(refresh.change()).toBeNull();
      expect(alertText()).toBe('');
    });

    it('explains a network failure', async () => {
      await openRating(3);

      (await rate(5)).error(new ProgressEvent('error'));
      await settle();

      expect(ratingsText('rating-error')).toBe('Could not save your rating. Try again.');
    });

    it('keeps the form usable when the own vote cannot be loaded and retries on demand', async () => {
      signIn();
      await openEdit();
      ownScoreRequest().flush(null, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(ratingsText('own-rating-error')).toContain('We could not load your rating.');
      expect(inRatings('own-rating-error')?.getAttribute('role')).toBe('alert');
      expect(stars()).toEqual([]);
      expect(field('name').value).toBe('Aurea Cliff');
      expect(alertText()).toBe('');

      inRatings('own-rating-retry')?.click();
      await settle();
      ownScoreRequest().flush({ score: 2 });
      await settle();

      expect(inRatings('own-rating-error')).toBeNull();
      expect(ratingsText('rating-control-value')).toBe('2 of 5');
      expect(find('sheet-discard-confirmation')).toBeNull();
    });

    it('saves the form while the own vote failed to load', async () => {
      signIn();
      await openEdit();
      ownScoreRequest().flush(null, { status: 500, statusText: 'Server Error' });
      await settle();
      await type('city', 'Amalfi');

      await submit();
      const request = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/hotels/h1');
      expect(request.request.body).toEqual({ ...emptyBody, city: 'Amalfi', country: 'Italy', pricePerNight: 400, discountPercent: 25 });
      request.flush(stored);
      await settle();

      expect(router.url).toBe('/admin?name=sea');
    });

    it('keeps pending form edits through a rating and saves them afterwards', async () => {
      await openRating(3);
      await type('city', 'Amalfi');

      (await rate(5)).flush({ sum: 11, count: 2, average: 5.5 });
      await settle();

      expect(field('city').value).toBe('Amalfi');
      expect((find<HTMLButtonElement>('hotel-form-submit') as HTMLButtonElement).disabled).toBe(false);
      await submit();
      const request = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/hotels/h1');
      expect(request.request.body).toEqual({ ...emptyBody, city: 'Amalfi', country: 'Italy', pricePerNight: 400, discountPercent: 25 });
      expect(request.request.body).not.toHaveProperty('rating');
      request.flush({ ...stored, address: { ...stored.address, city: 'Amalfi' } });
      await settle();

      expect(router.url).toBe('/admin?name=sea');
      expect(refresh.change()).toEqual({ message: 'Hotel saved.', sequence: 2 });
    });

    it('keeps the saved rating on screen when the form save fails', async () => {
      await openRating(3);
      (await rate(4)).flush({ sum: 10, count: 2, average: 5 });
      await settle();

      await submit();
      http.expectOne((r) => r.method === 'PUT').flush(null, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(alertText()).toContain('Something went wrong while saving. Try again.');
      expect(ratingsText('rating-summary')).toContain('5.00');
      expect(ratingsText('rating-control-value')).toBe('4 of 5');
      expect(ratingsText('rating-status')).toBe('Thanks, your rating was saved.');
    });

    it('lets the form be saved while a rating is still saving and never drops that rating', async () => {
      await openRating(3);
      stars()[4].click();
      await settle();
      const rating = http.expectOne((r) => r.method === 'POST' && r.url === '/api/hotels/h1/ratings');

      expect((find<HTMLButtonElement>('hotel-form-submit') as HTMLButtonElement).disabled).toBe(false);
      await submit();
      http.expectOne((r) => r.method === 'PUT' && r.url === '/api/hotels/h1').flush(stored);
      await settle();
      expect(router.url).toBe('/admin?name=sea');
      expect(rating.cancelled).toBe(false);

      rating.flush({ sum: 10, count: 2, average: 5 });
      await settle();

      expect(refresh.change()).toEqual({ message: null, sequence: 2 });
    });

    it('never renders the token or the account email in the section', async () => {
      await openRating(3);

      expect(root().innerHTML).not.toContain(administrator.accessToken);
      expect(ratings().textContent).not.toContain(administrator.email);
    });

    it('shows no rating control and asks for no own vote on the create sheet', async () => {
      signIn();
      await open('/admin/hotels/new');

      expect(find('hotel-ratings')).toBeNull();
      expect(root().querySelector('[role="radiogroup"]')).toBeNull();
      expect(find('image-slots-note')).not.toBeNull();
      http.expectNone((r) => r.url.includes('/ratings'));
    });
  });
});
