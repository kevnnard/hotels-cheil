import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminSheet } from './admin-sheet';
import { installDialogStub, removeDialogStub } from './dialog-test-support';

@Component({
  imports: [AdminSheet],
  template: `
    <button type="button" data-testid="opener" (click)="open.set(true)">Open</button>
    @if (open()) {
      <app-admin-sheet [title]="'New hotel'" [dirty]="dirty()" (closed)="onClosed()">
        <p data-testid="projected">Projected body</p>
      </app-admin-sheet>
    }
  `,
})
class SheetHost {
  readonly open = signal(false);
  readonly dirty = signal(false);
  closedCount = 0;

  onClosed(): void {
    this.closedCount += 1;
    this.open.set(false);
  }
}

describe('AdminSheet', () => {
  beforeEach(() => installDialogStub());

  afterEach(() => {
    removeDialogStub();
    document.body.classList.remove('overflow-hidden');
  });

  async function render(dirty = false) {
    const fixture = TestBed.createComponent(SheetHost);
    fixture.componentInstance.dirty.set(dirty);
    fixture.autoDetectChanges();
    const root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    const opener = root.querySelector('[data-testid="opener"]') as HTMLButtonElement;
    opener.focus();
    opener.click();
    await fixture.whenStable();
    const dialog = () => root.querySelector('dialog') as HTMLDialogElement | null;
    const find = (id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    return { fixture, root, opener, dialog, find };
  }

  it('opens as a modal bottom sheet with a heading, a drag handle, the projected body and a close button', async () => {
    const { dialog, find } = await render();
    const sheet = dialog() as HTMLDialogElement;

    expect(sheet.hasAttribute('open')).toBe(true);
    expect(sheet.getAttribute('data-modal')).toBe('true');
    const heading = sheet.querySelector('h2') as HTMLElement;
    expect(heading.textContent?.trim()).toBe('New hotel');
    expect(sheet.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(find('sheet-handle')?.getAttribute('aria-hidden')).toBe('true');
    expect(find('projected')?.textContent).toBe('Projected body');
    expect(find('sheet-close')?.getAttribute('aria-label')).toBe('Close');
    expect(find('sheet-close')?.className).toContain('min-h-11');
  });

  it('slides from the bottom with a 92vh limit, rounded top corners and a centered width from md', async () => {
    const { dialog, find } = await render();
    const classes = (dialog() as HTMLDialogElement).className;

    expect(classes).toContain('max-h-[92vh]');
    expect(classes).toContain('rounded-t-2xl');
    expect(classes).toContain('md:max-w-3xl');
    expect(classes).toContain('w-full');
    expect(classes).toContain('starting:open:translate-y-full');
    expect(classes).toContain('motion-safe:transition-transform');
    expect(classes).toContain('motion-reduce:transition-none');
    expect(find('sheet-header')?.className).toContain('sticky');
    expect(find('sheet-body')?.className).toContain('overflow-y-auto');
  });

  it('locks the page scroll while open and releases it after closing', async () => {
    const { fixture, find } = await render();

    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    find('sheet-close')?.click();
    await fixture.whenStable();

    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('closes with the close button, emits once and returns focus to the opener', async () => {
    const { fixture, dialog, find, opener } = await render();

    find('sheet-close')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.closedCount).toBe(1);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes with Escape', async () => {
    const { fixture, dialog } = await render();
    const cancel = new Event('cancel', { cancelable: true });

    dialog()?.dispatchEvent(cancel);
    await fixture.whenStable();

    expect(cancel.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('closes with a click on the backdrop but not inside the sheet', async () => {
    const { fixture, dialog, find } = await render();

    find('projected')?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.closedCount).toBe(0);

    dialog()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('asks before discarding unsaved changes and keeps editing on request', async () => {
    const { fixture, dialog, find } = await render(true);

    find('sheet-close')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.closedCount).toBe(0);
    expect(dialog()?.hasAttribute('open')).toBe(true);
    const confirmation = find('sheet-discard-confirmation') as HTMLElement;
    expect(confirmation.getAttribute('role')).toBe('alertdialog');
    expect(confirmation.textContent).toContain('Discard your changes?');
    expect(document.activeElement).toBe(find('sheet-keep-editing'));

    find('sheet-keep-editing')?.click();
    await fixture.whenStable();

    expect(find('sheet-discard-confirmation')).toBeNull();
    expect(dialog()?.hasAttribute('open')).toBe(true);
    expect(fixture.componentInstance.closedCount).toBe(0);
  });

  it('asks on Escape and on the backdrop when dirty, and closes after Discard', async () => {
    const { fixture, dialog, find, opener } = await render(true);

    dialog()?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(find('sheet-discard-confirmation')).not.toBeNull();
    find('sheet-keep-editing')?.click();
    await fixture.whenStable();

    dialog()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(find('sheet-discard-confirmation')).not.toBeNull();
    expect(fixture.componentInstance.closedCount).toBe(0);

    find('sheet-discard')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.closedCount).toBe(1);
    expect(document.activeElement).toBe(opener);
  });

  it('releases the scroll lock and restores focus when it is removed without closing', async () => {
    const { fixture, opener } = await render();

    fixture.componentInstance.open.set(false);
    await fixture.whenStable();

    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});
