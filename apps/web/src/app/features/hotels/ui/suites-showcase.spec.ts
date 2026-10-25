import { TestBed } from '@angular/core/testing';
import { SuitesShowcase } from './suites-showcase';

describe('SuitesShowcase', () => {
  function render() {
    const fixture = TestBed.createComponent(SuitesShowcase);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tabs = () => [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panels = () => [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    const visiblePanels = () => panels().filter((panel) => !panel.hidden);
    const press = (key: string) => {
      (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    return { fixture, root, tabs, panels, visiblePanels, press };
  }

  it('renders a tablist of three suites with the first one selected', () => {
    const { root, tabs, visiblePanels } = render();

    expect(root.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Suites');
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(['Signature Suite', 'Garden Villa', 'Terrace Loggia']);
    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs().map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(visiblePanels().length).toBe(1);
    expect(visiblePanels()[0].textContent).toContain('Signature Suite');
  });

  it('links each tab to its panel', () => {
    const { root, tabs } = render();

    for (const tab of tabs()) {
      const panel = root.querySelector(`#${tab.getAttribute('aria-controls')}`) as HTMLElement;
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    }
  });

  it('selects a suite on click and shows only its panel', () => {
    const { fixture, tabs, visiblePanels } = render();

    tabs()[1].click();
    fixture.detectChanges();

    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs().map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(visiblePanels().length).toBe(1);
    expect(visiblePanels()[0].querySelector('h3')?.textContent?.trim()).toBe('Garden Villa');
  });

  it('moves focus and selection with the arrow, Home and End keys', () => {
    const { tabs, visiblePanels, press } = render();
    tabs()[0].focus();

    press('ArrowRight');
    expect(document.activeElement).toBe(tabs()[1]);
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(visiblePanels()[0].querySelector('h3')?.textContent?.trim()).toBe('Garden Villa');

    press('End');
    expect(document.activeElement).toBe(tabs()[2]);
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');

    press('ArrowRight');
    expect(document.activeElement).toBe(tabs()[0]);

    press('ArrowLeft');
    expect(document.activeElement).toBe(tabs()[2]);

    press('Home');
    expect(document.activeElement).toBe(tabs()[0]);
    expect(visiblePanels()[0].querySelector('h3')?.textContent?.trim()).toBe('Signature Suite');
  });

  it('shows the suite description, a two column check-mark feature list and the placeholder panel', () => {
    const { visiblePanels } = render();
    const panel = visiblePanels()[0];

    expect(panel.querySelector('p')?.textContent?.trim().length).toBeGreaterThan(0);
    const list = panel.querySelector('ul') as HTMLElement;
    expect(list.classList).toContain('grid-cols-2');
    const items = [...list.querySelectorAll('li')];
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.every((item) => item.querySelector('svg') !== null)).toBe(true);
    expect(panel.querySelector('[data-testid="image-placeholder"]')).not.toBeNull();
    expect(panel.querySelector('img')).toBeNull();
    expect(panel.textContent).not.toContain('$');
  });
});
