import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';

const scrollLockClass = 'overflow-hidden';

let nextSheetId = 0;

@Component({
  selector: 'app-admin-sheet',
  template: `
    <dialog
      #dialog
      data-testid="admin-sheet"
      [attr.aria-labelledby]="titleId"
      class="mx-auto mt-auto mb-0 max-h-[92vh] w-full max-w-none overflow-hidden rounded-t-2xl bg-surface-container-lowest p-0 text-on-surface shadow-[0_-12px_40px_rgba(14,39,32,0.18)] backdrop:bg-primary/40 backdrop:backdrop-blur-sm translate-y-0 starting:open:translate-y-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none md:max-w-3xl"
      (cancel)="onCancel($event)"
      (close)="onClose()"
    >
      <div class="flex max-h-[92vh] flex-col">
        <header
          data-testid="sheet-header"
          class="sticky top-0 z-10 flex flex-col gap-space-sm border-b border-outline-variant/40 bg-surface-container-lowest px-margin-mobile pt-space-sm pb-space-sm md:px-space-lg"
        >
          <span data-testid="sheet-handle" aria-hidden="true" class="mx-auto h-1.5 w-12 rounded-full bg-outline-variant"></span>
          <div class="flex items-center justify-between gap-space-md">
            <h2 [id]="titleId" class="font-serif text-headline-sm text-primary">{{ title() }}</h2>
            <button
              #closeButton
              type="button"
              data-testid="sheet-close"
              aria-label="Close"
              class="inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              (click)="requestClose()"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          @if (confirmingDiscard()) {
            <div
              data-testid="sheet-discard-confirmation"
              role="alertdialog"
              [attr.aria-labelledby]="discardId"
              class="flex flex-col gap-space-sm rounded-lg bg-secondary-container/60 p-space-md sm:flex-row sm:items-center sm:justify-between"
            >
              <p [id]="discardId" class="text-body-md text-on-surface">Discard your changes?</p>
              <div class="flex gap-space-sm">
                <button
                  #keepEditingButton
                  type="button"
                  data-testid="sheet-keep-editing"
                  class="inline-flex min-h-11 items-center justify-center rounded-lg bg-surface-container-lowest px-space-md text-label-lg uppercase text-on-surface shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  (click)="keepEditing()"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  data-testid="sheet-discard"
                  class="inline-flex min-h-11 items-center justify-center rounded-lg bg-error px-space-md text-label-lg uppercase text-on-primary shadow-sm transition-colors hover:bg-on-error-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  (click)="discard()"
                >
                  Discard
                </button>
              </div>
            </div>
          }
        </header>
        <div data-testid="sheet-body" class="min-h-0 flex-1 overflow-y-auto px-margin-mobile py-space-lg md:px-space-lg">
          <ng-content />
        </div>
      </div>
    </dialog>
  `,
})
export class AdminSheet {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly keepEditingButton = viewChild<ElementRef<HTMLButtonElement>>('keepEditingButton');
  private opener: HTMLElement | null = null;
  private released = false;

  readonly title = input.required<string>();
  readonly dirty = input(false);
  readonly closed = output<void>();

  protected readonly titleId = `admin-sheet-title-${nextSheetId}`;
  protected readonly discardId = `admin-sheet-discard-${nextSheetId++}`;
  protected readonly confirmingDiscard = signal(false);

  constructor() {
    afterNextRender(() => this.open());
    inject(DestroyRef).onDestroy(() => this.release());
  }

  requestClose(): void {
    if (this.dirty()) {
      this.askToDiscard();
      return;
    }
    this.dialog().nativeElement.close();
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  protected onClose(): void {
    this.confirmingDiscard.set(false);
    this.release();
    this.closed.emit();
  }

  protected keepEditing(): void {
    this.confirmingDiscard.set(false);
    this.closeButton().nativeElement.focus();
  }

  protected discard(): void {
    this.confirmingDiscard.set(false);
    this.dialog().nativeElement.close();
  }

  private open(): void {
    const dialog = this.dialog().nativeElement;
    dialog.addEventListener('click', (event) => this.closeOnBackdrop(event));
    const active = this.document.activeElement;
    this.opener = active instanceof HTMLElement && active !== this.document.body ? active : null;
    this.document.body.classList.add(scrollLockClass);
    dialog.showModal();
  }

  private closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.requestClose();
    }
  }

  private askToDiscard(): void {
    this.confirmingDiscard.set(true);
    afterNextRender(() => this.keepEditingButton()?.nativeElement.focus(), { injector: this.injector });
  }

  private release(): void {
    if (this.released) {
      return;
    }
    this.released = true;
    this.document.body.classList.remove(scrollLockClass);
    const opener = this.opener;
    this.opener = null;
    if (opener?.isConnected) {
      opener.focus();
    }
  }
}
