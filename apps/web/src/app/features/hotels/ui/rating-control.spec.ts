import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RatingControl } from './rating-control';

@Component({
  imports: [RatingControl],
  template: `
    <app-rating-control
      [score]="score()"
      [disabled]="disabled()"
      [saving]="saving()"
      [readonly]="readonly()"
      (rated)="emitted.push($event)"
    />
  `,
})
class Host {
  readonly score = signal<number | null>(null);
  readonly disabled = signal(false);
  readonly saving = signal(false);
  readonly readonly = signal(false);
  readonly emitted: number[] = [];
}

describe('RatingControl', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  const group = () => element.querySelector('[role="radiogroup"]') as HTMLElement;
  const stars = () => Array.from(element.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const filled = () => stars().map((star) => star.getAttribute('data-filled'));
  const valueText = () => element.querySelector('[data-testid="rating-control-value"]')?.textContent?.trim();

  function press(target: HTMLElement, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function render(changes: Partial<{ score: number | null; disabled: boolean; saving: boolean; readonly: boolean }>): void {
    if (changes.score !== undefined) host.score.set(changes.score);
    if (changes.disabled !== undefined) host.disabled.set(changes.disabled);
    if (changes.saving !== undefined) host.saving.set(changes.saving);
    if (changes.readonly !== undefined) host.readonly.set(changes.readonly);
    fixture.detectChanges();
  }

  it('renders five labelled radios inside a radiogroup named Your rating', () => {
    const labelId = group().getAttribute('aria-labelledby') as string;

    expect(element.querySelector(`#${labelId}`)?.textContent?.trim()).toBe('Your rating');
    expect(stars().length).toBe(5);
    expect(stars().map((star) => star.getAttribute('aria-label'))).toEqual(['1 star', '2 stars', '3 stars', '4 stars', '5 stars']);
    for (const star of stars()) {
      expect(star.getAttribute('aria-checked')).toBe('false');
      expect(star.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(star.className).toMatch(/h-11/);
      expect(star.className).toMatch(/w-11/);
    }
    expect(valueText()).toBe('Not rated yet');
  });

  it('checks the current score, fills the stars up to it and shows the value as text', () => {
    render({ score: 4 });

    expect(stars().map((star) => star.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'true', 'false']);
    expect(filled()).toEqual(['true', 'true', 'true', 'true', 'false']);
    expect(valueText()).toBe('4 of 5');
  });

  it('keeps one tab stop on the checked star, or on the first one without a score', () => {
    expect(stars().map((star) => star.tabIndex)).toEqual([0, -1, -1, -1, -1]);

    render({ score: 3 });

    expect(stars().map((star) => star.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
  });

  it('emits the clicked score as an integer', () => {
    stars()[2].click();

    expect(host.emitted).toEqual([3]);
  });

  it('moves the focus with the arrow, Home and End keys and previews the focused score', () => {
    render({ score: 2 });
    stars()[1].focus();

    press(stars()[1], 'ArrowRight');
    expect(document.activeElement).toBe(stars()[2]);
    expect(filled()).toEqual(['true', 'true', 'true', 'false', 'false']);
    expect(stars().map((star) => star.tabIndex)).toEqual([-1, -1, 0, -1, -1]);

    press(stars()[2], 'ArrowUp');
    expect(document.activeElement).toBe(stars()[3]);

    press(stars()[3], 'End');
    expect(document.activeElement).toBe(stars()[4]);

    press(stars()[4], 'ArrowRight');
    expect(document.activeElement).toBe(stars()[4]);

    press(stars()[4], 'ArrowLeft');
    expect(document.activeElement).toBe(stars()[3]);

    press(stars()[3], 'ArrowDown');
    expect(document.activeElement).toBe(stars()[2]);

    press(stars()[2], 'Home');
    expect(document.activeElement).toBe(stars()[0]);

    press(stars()[0], 'ArrowLeft');
    expect(document.activeElement).toBe(stars()[0]);
    expect(host.emitted).toEqual([]);
  });

  it.each(['Enter', ' '])('selects the focused score with %j', (key) => {
    stars()[0].focus();
    press(stars()[0], 'ArrowRight');

    const event = press(stars()[1], key);

    expect(host.emitted).toEqual([2]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('previews the hovered score and restores the current one when the pointer leaves', () => {
    render({ score: 1 });

    stars()[3].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(filled()).toEqual(['true', 'true', 'true', 'true', 'false']);
    expect(valueText()).toBe('1 of 5');

    group().dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(filled()).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('shows the score but never emits when read only', () => {
    render({ score: 4, readonly: true });

    stars()[1].click();
    stars()[3].focus();
    press(stars()[3], 'Enter');
    stars()[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(group().getAttribute('aria-readonly')).toBe('true');
    expect(host.emitted).toEqual([]);
    expect(filled()).toEqual(['true', 'true', 'true', 'true', 'false']);
    expect(valueText()).toBe('4 of 5');
  });

  it('disables every star when disabled', () => {
    render({ score: 2, disabled: true });

    stars()[4].click();

    expect(group().getAttribute('aria-disabled')).toBe('true');
    expect(stars().every((star) => star.disabled)).toBe(true);
    expect(host.emitted).toEqual([]);
  });

  it('keeps the focus but ignores selections while saving', () => {
    render({ score: 2 });
    stars()[1].focus();
    render({ saving: true });

    stars()[4].click();
    press(stars()[1], 'Enter');

    expect(group().getAttribute('aria-busy')).toBe('true');
    expect(stars().every((star) => star.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(stars().some((star) => star.disabled)).toBe(false);
    expect(document.activeElement).toBe(stars()[1]);
    expect(host.emitted).toEqual([]);
  });

  it('respects reduced motion by animating only with motion-safe utilities', () => {
    for (const star of stars()) {
      const classes = star.className.split(/\s+/);
      expect(
        classes.filter((name) => !name.startsWith('motion-safe:') && (name.startsWith('transition') || name.includes('scale'))),
      ).toEqual([]);
      expect(classes.some((name) => name.startsWith('motion-safe:'))).toBe(true);
    }
  });
});
