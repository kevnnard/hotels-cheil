import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { CatalogFilters } from './catalog-filters';

describe('CatalogFilters', () => {
  let fixture: ComponentFixture<CatalogFilters>;
  let searchControl: FormControl<string>;
  let priceControl: FormControl<number>;

  function stubDesktop(matches: boolean) {
    vi.stubGlobal('matchMedia', (media: string) => ({ matches, media }));
  }

  function render(minRating: number | null = null, price = 1000) {
    searchControl = new FormControl('', { nonNullable: true });
    priceControl = new FormControl(price, { nonNullable: true });
    fixture = TestBed.createComponent(CatalogFilters);
    fixture.componentRef.setInput('searchControl', searchControl);
    fixture.componentRef.setInput('priceControl', priceControl);
    fixture.componentRef.setInput('minRating', minRating);
    fixture.detectChanges();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const query = (selector: string) => root().querySelector<HTMLElement>(selector);
  const queryAll = (selector: string) => Array.from(root().querySelectorAll<HTMLElement>(selector));

  function expectClasses(element: HTMLElement, names: string[]) {
    for (const name of names) {
      expect(element.classList.contains(name), `${name} on ${element.outerHTML}`).toBe(true);
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes one named search input, the rating group, the Filters disclosure and Reset in the bar', () => {
    render(4.9);

    const bar = query('[data-testid="search-panel"]') as HTMLElement;
    const inputs = Array.from(bar.querySelectorAll<HTMLInputElement>('input'));
    expect(inputs.length).toBe(1);
    const search = inputs[0];
    expect(search.dataset['testid']).toBe('search-input');
    expect(search.type).toBe('search');
    expect(search.disabled).toBe(false);
    expect(search.placeholder).toBe('Search hotels by name');
    const label = bar.querySelector<HTMLLabelElement>(`label[for="${search.id}"]`);
    expect((label?.textContent?.trim() ?? search.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);

    const group = bar.querySelector('[role="group"][aria-label="Minimum rating"]') as HTMLElement;
    expect(group).not.toBeNull();
    const options = Array.from(group.querySelectorAll<HTMLButtonElement>('button'));
    expect(options.map((option) => option.textContent?.trim())).toEqual(['All', '3.0+', '3.5+', '4.0+', '4.5+', '4.9+']);
    expect(options.map((option) => option.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false', 'false', 'true']);
    for (const option of options) {
      expect(option.disabled).toBe(false);
    }

    const toggle = bar.querySelector('[data-testid="more-filters"]') as HTMLButtonElement;
    expect(toggle.textContent?.trim()).toBe('Filters');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('advanced-filters');

    const reset = bar.querySelector('[data-testid="clear-filters"]') as HTMLButtonElement;
    expect(reset.textContent?.trim()).toBe('Reset');
    expect(reset.type).toBe('button');
  });

  it('hides Reset while no name and no rating are applied', () => {
    render(null);

    expect(query('[data-testid="clear-filters"]')).toBeNull();
  });

  it('shows Reset when a rating is applied and emits the clear action when clicked', () => {
    render(5);
    const cleared = vi.fn();
    fixture.componentInstance.cleared.subscribe(cleared);

    query('[data-testid="clear-filters"]')?.click();

    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('shows Reset while a name is typed and hides it again when the name is cleared silently', () => {
    render(null);

    searchControl.setValue('sea');
    fixture.detectChanges();
    expect(query('[data-testid="clear-filters"]')?.textContent?.trim()).toBe('Reset');

    searchControl.setValue('', { emitEvent: false });
    fixture.detectChanges();
    expect(query('[data-testid="clear-filters"]')).toBeNull();
  });

  it('treats a whitespace-only name as no name applied', () => {
    render(null);

    searchControl.setValue('   ');
    fixture.detectChanges();

    expect(query('[data-testid="clear-filters"]')).toBeNull();
  });

  it('carries no letter-spacing or uppercase class anywhere in the bar or on the advanced labels', () => {
    render(4.9);
    query('[data-testid="more-filters"]')?.click();
    fixture.detectChanges();

    const bar = query('[data-testid="search-panel"]') as HTMLElement;
    const elements = [bar, ...Array.from(bar.querySelectorAll<Element>('*'))];
    for (const element of elements) {
      const classes = Array.from(element.classList);
      expect(classes.filter((name) => /(^|:)tracking-/.test(name) || /(^|:)uppercase$/.test(name)), element.outerHTML).toEqual([]);
      expect(classes.filter((name) => /text-label-/.test(name)), element.outerHTML).toEqual([]);
    }
    for (const label of queryAll('#advanced-filters label[for], #advanced-filters [id$="-label"]')) {
      expect(label.className, label.outerHTML).not.toMatch(/uppercase|tracking-|text-label-/);
      for (const name of ['text-sm', 'font-medium', 'text-on-surface']) {
        expect(label.classList.contains(name), `${name} on ${label.outerHTML}`).toBe(true);
      }
    }
  });

  it('shows every advanced field as an active control, each with its own label', () => {
    render();

    const destination = query('[data-testid="filter-destination"]') as HTMLInputElement;
    expect(destination.type).toBe('text');
    expect(destination.placeholder).toBe('City or country');
    expect(destination.disabled).toBe(false);
    expect(query('label[for="filter-destination"]')?.textContent?.trim()).toBe('Destination');

    const type = query('[data-testid="filter-property-type"]') as HTMLSelectElement;
    expect(type.disabled).toBe(false);
    expect(type.options.length).toBe(1);
    expect(type.selectedOptions[0].textContent?.trim()).toBe('All types');
    expect(query('label[for="filter-property-type"]')?.textContent?.trim()).toBe('Property type');

    const chips = queryAll('[data-testid^="filter-category-"]') as HTMLButtonElement[];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
      'All',
      'Coastal retreats',
      'Desert oasis',
      'Alpine heights',
      'Heritage sanctuary',
    ]);
    for (const chip of chips) {
      expect(chip.disabled).toBe(false);
    }
    expect(chips.map((chip) => chip.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false']);

    const price = query('[data-testid="filter-price"]') as HTMLInputElement;
    expect(price.type).toBe('range');
    expect(price.disabled).toBe(false);
    expect([price.min, price.max, price.step]).toEqual(['50', '1000', '50']);
    expect(query('label[for="filter-price"]')?.textContent?.trim()).toBe('Maximum price per night');

    const amenities = queryAll('input[type="checkbox"]') as HTMLInputElement[];
    expect(amenities.map((box) => box.closest('label')?.textContent?.trim())).toEqual([
      'Spa',
      'Pool',
      'Restaurant',
      'Wi-Fi',
      'Pet friendly',
      'Concierge',
    ]);
    for (const box of amenities) {
      expect(box.disabled).toBe(false);
    }
  });

  it('shows one Not available yet note per inert group, in the same place and style, linked to its group', () => {
    render();

    const notes = queryAll('[data-testid="unavailable-note"]');
    expect(notes.length).toBe(4);
    const groups = queryAll('[data-testid="filter-group"]');
    expect(groups.length).toBe(4);
    for (const group of groups) {
      const groupNotes = Array.from(group.querySelectorAll('[data-testid="unavailable-note"]'));
      expect(groupNotes.length).toBe(1);
      expect(group.lastElementChild).toBe(groupNotes[0]);
      expect(groupNotes[0].textContent?.trim()).toBe('Not available yet');
      expect(groupNotes[0].id).not.toBe('');
    }
    expect(new Set(notes.map((note) => note.className)).size).toBe(1);
    for (const id of ['filter-destination', 'filter-property-type']) {
      const describedBy = query(`#${id}`)?.getAttribute('aria-describedby');
      expect(query(`#${describedBy}`)?.textContent?.trim()).toBe('Not available yet');
    }
    for (const group of queryAll('[role="group"][aria-labelledby]')) {
      expect(query(`#${group.getAttribute('aria-labelledby')}`)).not.toBeNull();
    }
  });

  it('looks active: no disabled attribute, no opacity and no disabled styling on the advanced controls', () => {
    render();

    const controls = queryAll('#advanced-filters input, #advanced-filters select, #advanced-filters button');
    expect(controls.length).toBeGreaterThan(10);
    for (const control of controls) {
      expect(control.hasAttribute('disabled'), control.outerHTML).toBe(false);
      expect(control.className, control.outerHTML).not.toMatch(/opacity|disabled:|not-allowed/);
    }
  });

  it('emits nothing and keeps the search untouched when the advanced fields change', () => {
    render();
    const ratingChange = vi.fn();
    const cleared = vi.fn();
    fixture.componentInstance.ratingChange.subscribe(ratingChange);
    fixture.componentInstance.cleared.subscribe(cleared);

    const destination = query('[data-testid="filter-destination"]') as HTMLInputElement;
    destination.value = 'Lima';
    destination.dispatchEvent(new Event('input'));
    const type = query('[data-testid="filter-property-type"]') as HTMLSelectElement;
    type.dispatchEvent(new Event('change'));
    for (const control of queryAll('input[type="checkbox"], [data-testid^="filter-category-"]')) {
      control.click();
    }
    fixture.detectChanges();

    expect(ratingChange).not.toHaveBeenCalled();
    expect(cleared).not.toHaveBeenCalled();
    expect(searchControl.value).toBe('');
    expect(priceControl.value).toBe(1000);
  });

  it('turns the price group into a working control without the Not available yet note', () => {
    render();

    const price = query('[data-testid="filter-price"]') as HTMLInputElement;
    const group = query('[data-testid="price-group"]') as HTMLElement;
    expect(group.contains(price)).toBe(true);
    expect(group.querySelector('[data-testid="unavailable-note"]')).toBeNull();
    expect(group.textContent).not.toContain('Not available yet');
    expect(query('#note-price')).toBeNull();
    const describedBy = price.getAttribute('aria-describedby');
    expect(query(`#${describedBy}`)?.dataset['testid']).toBe('price-value');
  });

  it('shows Any price at the top of the range and the limit in USD below it', () => {
    render();

    const price = query('[data-testid="filter-price"]') as HTMLInputElement;
    const value = query('[data-testid="price-value"]') as HTMLElement;
    expect(price.value).toBe('1000');
    expect(value.textContent?.trim()).toBe('Any price');
    expect(price.getAttribute('aria-valuetext')).toBe('Any price');

    price.value = '400';
    price.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(value.textContent?.trim()).toBe('Up to $400');
    expect(price.getAttribute('aria-valuetext')).toBe('Up to $400');
  });

  it('writes the slider position into the price control as a number', () => {
    render();

    const price = query('[data-testid="filter-price"]') as HTMLInputElement;
    price.value = '300';
    price.dispatchEvent(new Event('input'));
    price.dispatchEvent(new Event('change'));

    expect(priceControl.value).toBe(300);
  });

  it('reflects a price control set from outside in the slider and its value text', () => {
    render(null, 250);

    expect((query('[data-testid="filter-price"]') as HTMLInputElement).value).toBe('250');
    expect(query('[data-testid="price-value"]')?.textContent?.trim()).toBe('Up to $250');

    priceControl.setValue(1000, { emitEvent: false });
    fixture.detectChanges();

    expect(query('[data-testid="price-value"]')?.textContent?.trim()).toBe('Any price');
  });

  it('shows Reset while only a price limit is applied and hides it at Any price', () => {
    render(null, 300);

    expect(query('[data-testid="clear-filters"]')?.textContent?.trim()).toBe('Reset');

    priceControl.setValue(1000, { emitEvent: false });
    fixture.detectChanges();

    expect(query('[data-testid="clear-filters"]')).toBeNull();
  });

  it('emits the chosen rating, including null for All', () => {
    render(4.9);
    const ratingChange = vi.fn();
    fixture.componentInstance.ratingChange.subscribe(ratingChange);

    for (const value of ['3', '3.5', '4', '4.5', '4.9', 'all']) {
      query(`[data-testid="rating-${value}"]`)?.click();
    }

    expect(ratingChange.mock.calls).toEqual([[3], [3.5], [4], [4.5], [4.9], [null]]);
    expect(query('[data-testid="rating-4.9"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it.each([
    [4.95, '4.95+', ['All', '3.0+', '3.5+', '4.0+', '4.5+', '4.9+', '4.95+']],
    [5, '5.0+', ['All', '3.0+', '3.5+', '4.0+', '4.5+', '4.9+', '5.0+']],
    [2, '2.0+', ['All', '2.0+', '3.0+', '3.5+', '4.0+', '4.5+', '4.9+']],
  ])('shows a selected rating %s outside the thresholds as one extra pressed segment', (value, label, labels) => {
    render(value);

    const options = queryAll('[data-testid^="rating-"]');
    expect(options.map((option) => option.textContent?.trim())).toEqual(labels);
    const pressed = options.filter((option) => option.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((option) => option.dataset['testid'])).toEqual([`rating-${value}`]);
    expect(pressed[0].textContent?.trim()).toBe(label);
  });

  it('emits another threshold when one is chosen while an extra rating is selected', () => {
    render(4.95);
    const ratingChange = vi.fn();
    fixture.componentInstance.ratingChange.subscribe(ratingChange);

    query('[data-testid="rating-4"]')?.click();

    expect(ratingChange.mock.calls).toEqual([[4]]);
  });

  it('drops the extra segment once the selected rating is one of the thresholds', () => {
    render(4.95);

    fixture.componentRef.setInput('minRating', 4);
    fixture.detectChanges();

    expect(query('[data-testid="rating-4.95"]')).toBeNull();
    expect(queryAll('[data-testid^="rating-"]').length).toBe(6);
    expect(queryAll('[aria-pressed="true"][data-testid^="rating-"]').map((option) => option.dataset['testid'])).toEqual(['rating-4']);
  });

  it('keeps seven rating segments scrolling inside their own group without shrinking them', () => {
    render(4.95);

    const group = query('[role="group"][aria-label="Minimum rating"]') as HTMLElement;
    expectClasses(group, ['overflow-x-auto', 'min-w-0', 'w-full', 'h-13', 'md:h-11']);
    expectClasses(group.parentElement as HTMLElement, ['min-w-0']);
    const options = queryAll('[data-testid^="rating-"]');
    expect(options.length).toBe(7);
    for (const option of options) {
      expectClasses(option, ['shrink-0', 'whitespace-nowrap', 'h-11', 'min-w-11', 'md:h-9']);
    }
  });

  it.each([false, true])('starts the disclosure collapsed at every width (desktop %s)', (desktop) => {
    stubDesktop(desktop);
    render();

    const toggle = query('[data-testid="more-filters"]') as HTMLButtonElement;
    const panel = query('#advanced-filters') as HTMLElement;
    expect(toggle.textContent?.trim()).toBe('Filters');
    expect(toggle.getAttribute('aria-controls')).toBe('advanced-filters');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
    expect(panel.hasAttribute('hidden')).toBe(true);

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(query('[data-testid="filters-chevron"]')?.classList.contains('rotate-180')).toBe(true);

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
    expect(query('[data-testid="filters-chevron"]')?.classList.contains('rotate-180')).toBe(false);
  });

  it('makes only the compact bar sticky and leaves the advanced panel in normal flow', () => {
    render();

    const bar = query('[data-testid="search-panel"]') as HTMLElement;
    expect(bar.classList.contains('md:sticky')).toBe(true);
    expect(bar.classList.contains('md:top-(--header-height)')).toBe(true);
    expect(bar.contains(query('#advanced-filters'))).toBe(false);
    expect(bar.contains(query('[data-testid="more-filters"]'))).toBe(true);
    const advanced = query('#advanced-filters') as HTMLElement;
    expect(advanced.closest('[class*="sticky"]')).toBeNull();
    expect(advanced.className).not.toContain('sticky');
    expect((fixture.nativeElement as HTMLElement).classList.contains('contents')).toBe(true);
  });

  it('lays the bar out as one centred row of 44px controls from lg, with the search on its own row at md and a column on mobile', () => {
    render(4.95);

    const bar = query('[data-testid="search-panel"]') as HTMLElement;
    expectClasses(bar, ['p-3', 'rounded-xl']);
    const primary = query('[data-testid="primary-filters"]') as HTMLElement;
    expectClasses(primary, ['flex', 'flex-col', 'gap-3', 'md:flex-row', 'md:flex-wrap', 'md:items-center', 'lg:flex-nowrap']);
    expect(bar.querySelector('.w-px')).toBeNull();

    const group = query('[data-testid="search-group"]') as HTMLElement;
    expectClasses(group, ['relative', 'h-11', 'flex-1', 'min-w-0', 'md:basis-full', 'md:max-w-xl', 'lg:basis-auto', 'rounded-lg', 'border', 'border-outline-variant', 'bg-surface-container-lowest', 'focus-within:ring-2']);
    expect(group.contains(query('[data-testid="search-input"]'))).toBe(true);
    expect(group.querySelector('svg')?.classList.contains('absolute')).toBe(true);
    expectClasses(query('[data-testid="search-input"]') as HTMLElement, ['pl-10', 'text-sm', 'h-full', 'w-full']);

    const rating = query('[role="group"][aria-label="Minimum rating"]') as HTMLElement;
    expectClasses(rating, ['h-13', 'md:h-11', 'rounded-lg', 'bg-surface-container', 'p-1', 'overflow-x-auto', 'w-full', 'md:w-auto']);

    const toggle = query('[data-testid="more-filters"]') as HTMLElement;
    expectClasses(toggle, ['h-11', 'px-4', 'text-sm', 'font-medium', 'border', 'border-outline-variant', 'bg-transparent', 'flex-1', 'md:flex-none']);
    expect(toggle.querySelectorAll('svg').length).toBe(2);

    const reset = query('[data-testid="clear-filters"]') as HTMLElement;
    expectClasses(reset, ['h-11', 'px-3', 'text-sm', 'text-on-surface-variant', 'hover:text-on-surface']);
    expect(reset.parentElement).toBe(toggle.parentElement);
    expectClasses(reset.parentElement as HTMLElement, ['flex', 'items-center', 'gap-3', 'md:ml-auto']);

    const advanced = query('#advanced-filters') as HTMLElement;
    expectClasses(advanced, ['grid-cols-1', 'sm:grid-cols-2', 'gap-space-md']);
    expect(advanced.className).not.toMatch(/gap-[xy]-/);
  });

  it('renders the rating options as one segmented control with a single selected segment', () => {
    render(4.95);

    const options = queryAll('[data-testid^="rating-"]');
    expect(options.length).toBe(7);
    const baseClasses = ['h-11', 'md:h-9', 'px-3', 'text-sm', 'font-medium', 'rounded-md', 'transition-colors'];
    const selectedClasses = ['bg-primary-container', 'text-on-primary', 'shadow-sm'];
    const unselectedClasses = ['text-on-surface-variant', 'hover:bg-surface-container-high'];
    for (const option of options) {
      expectClasses(option, baseClasses);
      const selected = option.getAttribute('aria-pressed') === 'true';
      expectClasses(option, selected ? selectedClasses : unselectedClasses);
      for (const name of selected ? unselectedClasses : selectedClasses) {
        expect(option.classList.contains(name), `${name} on ${option.outerHTML}`).toBe(false);
      }
      expect(option.classList.contains('bg-surface-container')).toBe(false);
    }
    expect(options.filter((option) => option.getAttribute('aria-pressed') === 'true').map((option) => option.dataset['testid'])).toEqual(['rating-4.95']);
  });

  it('selects All when no minimum rating is set', () => {
    render(null);

    const pressed = queryAll('[data-testid^="rating-"][aria-pressed="true"]');
    expect(pressed.map((pill) => pill.dataset['testid'])).toEqual(['rating-all']);
  });

  it('gives every interactive element a touch target of at least 44px', () => {
    render(4.9);

    const ratingGroup = query('[role="group"][aria-label="Minimum rating"]') as HTMLElement;
    expect(ratingGroup.classList.contains('md:h-11')).toBe(true);
    for (const segment of Array.from(ratingGroup.querySelectorAll<HTMLElement>('button'))) {
      expect(segment.classList.contains('h-11'), segment.outerHTML).toBe(true);
    }
    const targets = queryAll('button, select, input:not([type="checkbox"])').filter((target) => !ratingGroup.contains(target));
    expect(targets.length).toBeGreaterThan(10);
    for (const target of targets) {
      const sized = ['min-h-11', 'h-11', 'h-full'].some((name) => target.classList.contains(name));
      expect(sized, target.outerHTML).toBe(true);
    }
    for (const box of queryAll('input[type="checkbox"]')) {
      const label = box.closest('label') as HTMLElement;
      expect(label.classList.contains('min-h-11'), label.outerHTML).toBe(true);
    }
  });

  it('gives every interactive element a visible focus indicator', () => {
    render(4.9);

    const search = query('[data-testid="search-input"]') as HTMLElement;
    expect(query('[data-testid="search-group"]')?.className).toContain('focus-within:ring');
    for (const target of queryAll('button, select, input:not([type="checkbox"])').filter((target) => target !== search)) {
      expect(target.className, target.outerHTML).toContain('focus-visible:outline');
    }
  });
});
