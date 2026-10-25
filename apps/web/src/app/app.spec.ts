import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
  });

  it('renders the routed public home inside the root component', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);

    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    TestBed.tick();
    const requests = http.match((request) => request.url === '/api/public/hotels');
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      request.flush({ items: [], page: 1, pageSize: 9, totalItems: 0, totalPages: 0 });
    }
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="public-home"]')).not.toBeNull();
  });
});
