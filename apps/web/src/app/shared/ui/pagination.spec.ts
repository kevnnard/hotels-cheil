import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

@Component({
  imports: [Pagination],
  template: `<app-pagination [page]="page()" [totalPages]="totalPages()" (pageChange)="requested.push($event)" />`,
})
class Host {
  readonly page = signal(1);
  readonly totalPages = signal(3);
  readonly requested: number[] = [];
}

describe('Pagination', () => {
  function setup(page: number, totalPages: number) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.page.set(page);
    fixture.componentInstance.totalPages.set(totalPages);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      host: fixture.componentInstance,
      previous: root.querySelector<HTMLButtonElement>('[data-testid="pagination-previous"]'),
      next: root.querySelector<HTMLButtonElement>('[data-testid="pagination-next"]'),
      summary: root.querySelector('[data-testid="pagination-summary"]')?.textContent?.trim(),
    };
  }

  it('disables the previous button on the first page', () => {
    const { previous, next } = setup(1, 3);

    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);
  });

  it('disables the next button on the last page', () => {
    const { previous, next } = setup(3, 3);

    expect(previous?.disabled).toBe(false);
    expect(next?.disabled).toBe(true);
  });

  it('requests the neighbouring pages', () => {
    const { host, previous, next } = setup(2, 3);

    previous?.click();
    next?.click();

    expect(host.requested).toEqual([1, 3]);
  });

  it('shows the current page and the total', () => {
    expect(setup(2, 3).summary).toBe('Page 2 of 3');
  });

  it('labels the controls', () => {
    const { previous, next } = setup(2, 3);

    expect(previous?.textContent?.trim()).toBe('Previous');
    expect(next?.textContent?.trim()).toBe('Next');
  });

  it('renders nothing when there is a single page', () => {
    const { previous, next } = setup(1, 1);

    expect(previous).toBeNull();
    expect(next).toBeNull();
  });

  it('gives both buttons a touch target of at least 44px', () => {
    const { previous, next } = setup(2, 3);

    expect(previous?.classList.contains('min-h-11')).toBe(true);
    expect(next?.classList.contains('min-h-11')).toBe(true);
  });
});
