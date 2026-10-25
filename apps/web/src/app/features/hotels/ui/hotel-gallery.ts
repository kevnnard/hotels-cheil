import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, viewChild } from '@angular/core';
import { HotelGalleryImage } from '../data/hotel.models';
import { HotelImageView } from './hotel-image-view';

const mosaicPositions = [0, 1, 2];
const scrollLockClass = 'overflow-hidden';

interface GalleryTile {
  readonly position: number;
  readonly hasImage: boolean;
  readonly alt: string;
}

@Component({
  selector: 'app-hotel-gallery',
  imports: [HotelImageView, NgTemplateOutlet],
  host: { class: 'block' },
  template: `
    <ng-template #tileContent let-tile>
      @if (tile.hasImage) {
        <button
          type="button"
          data-testid="gallery-open"
          class="group block h-full w-full cursor-pointer overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-secondary-container"
          (click)="open($event)"
        >
          <span class="sr-only">Open the photo gallery: </span>
          <app-hotel-image-view
            class="h-full w-full motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:scale-[1.02]"
            [hotelId]="hotelId()"
            [hotelName]="hotelName()"
            [hasImage]="true"
            [position]="tile.position"
            [alt]="tile.alt"
          />
        </button>
      } @else {
        <app-hotel-image-view class="h-full w-full" [hotelId]="hotelId()" [hotelName]="hotelName()" [hasImage]="false" />
      }
    </ng-template>

    <div class="relative">
      <div
        data-testid="gallery-mosaic"
        class="grid grid-cols-1 gap-space-sm overflow-hidden rounded-xl bg-surface-container-highest md:grid-cols-12"
      >
        @let main = tiles()[0];
        <div
          data-testid="gallery-tile"
          [attr.data-position]="main.position"
          class="relative h-95 overflow-hidden sm:h-120 md:col-span-8 lg:h-155"
        >
          <ng-container *ngTemplateOutlet="tileContent; context: { $implicit: main }" />
          @if (main.hasImage) {
            <div class="pointer-events-none absolute inset-0 bg-linear-to-t from-primary/40 via-transparent to-transparent"></div>
          }
        </div>
        <div
          data-testid="gallery-side"
          class="grid h-95 grid-cols-2 gap-space-sm sm:h-120 md:col-span-4 md:grid-cols-1 lg:h-155"
        >
          @for (tile of sideTiles(); track tile.position) {
            <div data-testid="gallery-tile" [attr.data-position]="tile.position" class="relative h-full overflow-hidden">
              <ng-container *ngTemplateOutlet="tileContent; context: { $implicit: tile }" />
            </div>
          }
        </div>
      </div>
      @if (count() > 0) {
        <button
          type="button"
          data-testid="gallery-view-all"
          class="absolute bottom-space-md right-space-md z-10 inline-flex min-h-11 cursor-pointer items-center gap-space-xs rounded-lg bg-surface/90 px-space-md py-space-sm text-label-lg uppercase text-primary shadow-lg backdrop-blur-md transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          (click)="open($event)"
        >
          <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M3 5h18v14H3V5Zm0 10 5-5 4 4 3-3 6 6M15.5 8.5h.01" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>View all photos</span>
          <span data-testid="gallery-count" class="rounded bg-primary px-1.5 py-0.5 text-label-sm text-on-primary">{{ count() }}</span>
        </button>
      }
    </div>

    <dialog
      #dialog
      data-testid="gallery-dialog"
      aria-labelledby="hotel-gallery-title"
      class="m-auto max-h-[90vh] w-[min(92vw,90rem)] max-w-none overflow-hidden rounded-xl bg-primary p-0 text-surface backdrop:bg-primary/80 backdrop:backdrop-blur-sm"
      (close)="closed()"
    >
      <div class="flex max-h-[90vh] flex-col">
        <div class="flex items-center justify-between gap-space-md px-space-md py-space-md md:px-space-lg">
          <div class="flex flex-wrap items-baseline gap-x-space-md gap-y-space-xs">
            <h2 id="hotel-gallery-title" class="font-serif text-headline-sm text-surface">Photo gallery</h2>
            <span class="text-label-md uppercase text-secondary-fixed">{{ hotelName() }} • {{ countLabel() }}</span>
          </div>
          <button
            type="button"
            data-testid="gallery-close"
            aria-label="Close the photo gallery"
            class="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-surface transition-colors hover:bg-surface/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"
            (click)="close()"
          >
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <ul class="grid min-h-0 grid-cols-1 content-start gap-space-md overflow-y-auto px-space-md pb-space-lg sm:grid-cols-2 md:px-space-lg lg:grid-cols-3">
          @for (image of orderedImages(); track image.position) {
            <li class="h-80 overflow-hidden rounded-lg bg-primary-container">
              <app-hotel-image-view
                class="h-full w-full"
                [hotelId]="hotelId()"
                [hotelName]="hotelName()"
                [hasImage]="true"
                [position]="image.position"
                [alt]="altFor(image.position)"
              />
            </li>
          }
        </ul>
      </div>
    </dialog>
  `,
})
export class HotelGallery {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;

  readonly hotelId = input.required<string>();
  readonly hotelName = input.required<string>();
  readonly images = input.required<HotelGalleryImage[]>();

  protected readonly orderedImages = computed(() => [...this.images()].sort((first, second) => first.position - second.position));

  protected readonly tiles = computed<GalleryTile[]>(() => {
    const stored = new Set(this.images().map((image) => image.position));
    return mosaicPositions.map((position) => ({
      position,
      hasImage: stored.has(position),
      alt: this.altFor(position),
    }));
  });

  protected readonly sideTiles = computed(() => this.tiles().slice(1));
  protected readonly count = computed(() => this.images().length);
  protected readonly countLabel = computed(() => `${this.count()} ${this.count() === 1 ? 'photo' : 'photos'}`);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.unlockScroll());
    afterNextRender(() => {
      this.dialog().nativeElement.addEventListener('click', (event) => this.closeOnBackdrop(event));
    });
  }

  protected altFor(position: number): string {
    return `${this.hotelName()}, photo ${position + 1}`;
  }

  protected open(event: Event): void {
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.document.body.classList.add(scrollLockClass);
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  private closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.close();
    }
  }

  protected closed(): void {
    this.unlockScroll();
    this.opener?.focus();
    this.opener = null;
  }

  private unlockScroll(): void {
    this.document.body.classList.remove(scrollLockClass);
  }
}
