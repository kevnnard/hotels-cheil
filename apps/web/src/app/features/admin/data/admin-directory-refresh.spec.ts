import { TestBed } from '@angular/core/testing';
import { AdminDirectoryRefresh } from './admin-directory-refresh';

describe('AdminDirectoryRefresh', () => {
  it('starts without a change', () => {
    expect(TestBed.inject(AdminDirectoryRefresh).change()).toBeNull();
  });

  it('numbers every announced change so the same message twice is still a new change', () => {
    const refresh = TestBed.inject(AdminDirectoryRefresh);

    refresh.announce('Hotel saved.');
    const first = refresh.change();
    refresh.announce('Hotel saved.');
    const second = refresh.change();

    expect(first).toEqual({ message: 'Hotel saved.', sequence: 1 });
    expect(second).toEqual({ message: 'Hotel saved.', sequence: 2 });
  });

  it('announces a quiet change without a message', () => {
    const refresh = TestBed.inject(AdminDirectoryRefresh);

    refresh.announce('Hotel saved.');
    refresh.announce();

    expect(refresh.change()).toEqual({ message: null, sequence: 2 });
  });
});
