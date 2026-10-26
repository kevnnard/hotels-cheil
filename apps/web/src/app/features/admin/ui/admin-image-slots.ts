import { Component, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { HotelImageView } from '../../hotels/ui/hotel-image-view';
import { ImagePosition, ImageSlotState, imageSlotName } from '../data/admin-hotel.models';
import { imageUploadLimits } from '../data/hotel-form-rules';

export interface ImageChoice {
  readonly position: ImagePosition;
  readonly file: File;
}

const actionClasses =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-space-md text-label-lg uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60';

@Component({
  selector: 'app-admin-image-slots',
  imports: [HotelImageView],
  template: `
    <section aria-labelledby="hotel-section-images" class="flex flex-col gap-space-md rounded-xl bg-surface-container-low/70 p-space-md md:p-space-lg">
      <header class="flex flex-col gap-0.5">
        <span class="text-label-sm uppercase tracking-widest text-secondary">Section 05</span>
        <h3 id="hotel-section-images" class="font-serif text-headline-sm text-primary">Images</h3>
        <p id="image-slot-hint" data-testid="image-slot-hint" class="text-body-sm text-on-surface-variant">{{ hint }}</p>
        @if (hotelId() === null) {
          <p data-testid="image-slots-note" class="text-body-sm text-on-surface-variant">
            Chosen images are uploaded after the hotel is created.
          </p>
        } @else {
          <p class="text-body-sm text-on-surface-variant">Image changes are saved at once, apart from the Save button.</p>
        }
      </header>
      <ul class="grid grid-cols-1 gap-space-md sm:grid-cols-3">
        @for (slot of slots(); track slot.position) {
          @let name = slotName(slot.position);
          @let busy = slot.status !== 'idle';
          <li
            [attr.data-testid]="'image-slot-' + slot.position"
            [attr.data-position]="slot.position"
            [attr.aria-busy]="busy"
            class="flex flex-col gap-space-sm rounded-lg bg-surface-container-lowest p-space-sm shadow-xs"
          >
            <div class="flex items-center justify-between">
              <span class="text-label-lg uppercase text-on-surface">{{ slotTitle(slot.position) }}</span>
              @if (slot.position === 0) {
                <span class="rounded bg-secondary-container px-1.5 py-0.5 text-label-sm uppercase text-on-secondary-fixed">Cover</span>
              }
            </div>
            <div class="aspect-4/3 overflow-hidden rounded-lg bg-surface-container" [class.opacity-60]="busy">
              @if (hotelId(); as id) {
                <app-hotel-image-view
                  class="h-full w-full"
                  [hotelId]="id"
                  [hotelName]="hotelName()"
                  [hasImage]="slot.hasImage"
                  [position]="slot.position"
                  [version]="slot.version"
                  [alt]="hotelName() + ', ' + name"
                  [compact]="true"
                />
              } @else {
                <div class="flex h-full w-full flex-col items-center justify-center gap-space-xs p-space-sm text-center text-on-surface-variant">
                  <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  @if (slot.pendingFile; as file) {
                    <span [attr.data-testid]="'image-slot-' + slot.position + '-file'" class="break-all text-body-sm text-on-surface">{{ file.name }}</span>
                  } @else {
                    <span class="text-body-sm">No image chosen</span>
                  }
                </div>
              }
            </div>
            <input
              #fileInput
              type="file"
              tabindex="-1"
              class="sr-only"
              [attr.data-testid]="'image-slot-' + slot.position + '-input'"
              [attr.aria-label]="'File for ' + name"
              [accept]="accept"
              [disabled]="disabled() || busy"
              (change)="onFileChange(slot.position, fileInput)"
            />
            <div class="flex flex-wrap gap-space-xs">
              <button
                type="button"
                [attr.data-testid]="'image-slot-' + slot.position + '-upload'"
                [attr.aria-label]="uploadAction(slot) + ' ' + name"
                aria-describedby="image-slot-hint"
                [class]="actionClasses + ' bg-primary-container text-on-primary hover:bg-primary'"
                [disabled]="disabled() || busy"
                (click)="fileInput.click()"
              >
                {{ slot.status === 'uploading' ? 'Uploading…' : uploadLabel(slot) }}
              </button>
              @if (hotelId() === null) {
                @if (slot.pendingFile) {
                  <button
                    type="button"
                    [attr.data-testid]="'image-slot-' + slot.position + '-clear'"
                    [attr.aria-label]="'Clear ' + name"
                    [class]="actionClasses + ' bg-surface-container text-on-surface hover:bg-surface-container-high'"
                    [disabled]="disabled()"
                    (click)="pendingCleared.emit(slot.position)"
                  >
                    Clear
                  </button>
                }
              } @else if (slot.hasImage) {
                <button
                  type="button"
                  [attr.data-testid]="'image-slot-' + slot.position + '-remove'"
                  [attr.aria-label]="'Remove ' + name"
                  [class]="actionClasses + ' text-error hover:bg-error-container'"
                  [disabled]="disabled() || busy"
                  (click)="askToRemove(slot.position)"
                >
                  {{ slot.status === 'removing' ? 'Removing…' : 'Remove' }}
                </button>
              }
            </div>
            @if (confirming() === slot.position) {
              <div
                role="group"
                [attr.aria-label]="'Remove ' + name"
                [attr.data-testid]="'image-slot-' + slot.position + '-confirm'"
                class="flex flex-col gap-space-xs rounded-lg bg-error-container/60 p-space-sm"
              >
                <p class="text-body-sm text-on-surface">Remove this image?</p>
                <div class="flex flex-wrap gap-space-xs">
                  <button
                    #keepButton
                    type="button"
                    [attr.data-testid]="'image-slot-' + slot.position + '-keep'"
                    [class]="actionClasses + ' bg-surface-container-lowest text-on-surface hover:bg-surface-container'"
                    [disabled]="disabled()"
                    (click)="keep()"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    [attr.data-testid]="'image-slot-' + slot.position + '-confirm-remove'"
                    [class]="actionClasses + ' bg-error text-on-primary hover:bg-on-error-container'"
                    [disabled]="disabled()"
                    (click)="confirmRemove(slot.position)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            }
            <p [attr.data-testid]="'image-slot-' + slot.position + '-error'" role="alert" class="text-body-sm text-error empty:hidden">{{ slot.error }}</p>
            <p [attr.data-testid]="'image-slot-' + slot.position + '-status'" role="status" class="text-body-sm text-primary empty:hidden">{{ slot.message }}</p>
          </li>
        }
      </ul>
    </section>
  `,
})
export class AdminImageSlots {
  private readonly injector = inject(Injector);
  private readonly keepButton = viewChild<ElementRef<HTMLButtonElement>>('keepButton');

  readonly hotelId = input<string | null>(null);
  readonly hotelName = input('');
  readonly slots = input.required<readonly ImageSlotState[]>();
  readonly disabled = input(false);
  readonly fileChosen = output<ImageChoice>();
  readonly removeConfirmed = output<ImagePosition>();
  readonly pendingCleared = output<ImagePosition>();

  protected readonly hint = imageUploadLimits.hint;
  protected readonly accept = imageUploadLimits.accept;
  protected readonly actionClasses = actionClasses;
  protected readonly confirming = signal<ImagePosition | null>(null);

  protected slotName(position: ImagePosition): string {
    return imageSlotName(position);
  }

  protected slotTitle(position: ImagePosition): string {
    const name = imageSlotName(position);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  protected uploadAction(slot: ImageSlotState): string {
    if (this.hotelId() === null) {
      return slot.pendingFile === null ? 'Choose' : 'Change';
    }
    return slot.hasImage ? 'Replace' : 'Upload';
  }

  protected uploadLabel(slot: ImageSlotState): string {
    const action = this.uploadAction(slot);
    return this.hotelId() === null ? `${action} image` : action;
  }

  protected onFileChange(position: ImagePosition, field: HTMLInputElement): void {
    const file = field.files?.[0];
    field.value = '';
    if (file !== undefined) {
      this.fileChosen.emit({ position, file });
    }
  }

  protected askToRemove(position: ImagePosition): void {
    this.confirming.set(position);
    afterNextRender(() => this.keepButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected keep(): void {
    this.confirming.set(null);
  }

  protected confirmRemove(position: ImagePosition): void {
    this.confirming.set(null);
    this.removeConfirmed.emit(position);
  }
}
