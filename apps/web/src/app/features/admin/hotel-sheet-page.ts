import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, concatMap, from, map, of, switchMap, toArray } from 'rxjs';
import { StatePanel } from '../../shared/ui/state-panel';
import { Hotel, HotelRating } from '../hotels/data/hotel.models';
import { createOwnRating } from '../hotels/data/own-rating';
import { OwnRatingField } from '../hotels/ui/own-rating-field';
import { RatingSummary } from '../hotels/ui/rating-summary';
import { AdminDirectoryRefresh } from './data/admin-directory-refresh';
import {
  FormAlert,
  HotelRequest,
  ImagePosition,
  ImageSlotState,
  emptyImageSlots,
  imageSlotName,
  imageSlotsOf,
} from './data/admin-hotel.models';
import { AdminHotelsService } from './data/admin-hotels.service';
import { checkImageFile } from './data/hotel-form-rules';
import { describeHotelFailure, describeImageFailure } from './data/hotel-failure';
import { AdminHotelForm } from './ui/admin-hotel-form';
import { AdminImageSlots, ImageChoice } from './ui/admin-image-slots';
import { AdminSheet } from './ui/admin-sheet';

type SheetView = 'form' | 'loading' | 'not-found' | 'error';

interface PendingUpload {
  readonly position: ImagePosition;
  readonly file: File;
}

const createdMessage = 'Hotel created.';
const savedMessage = 'Hotel saved.';
const noticeKey = 'notice';

function httpFailureOf(error: unknown): HttpErrorResponse | null {
  if (error instanceof HttpErrorResponse) {
    return error;
  }
  const cause = typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : null;
  return cause instanceof HttpErrorResponse ? cause : null;
}

function failedUploadsNotice(positions: readonly ImagePosition[]): string {
  return `Hotel created, but these images could not be uploaded: ${positions.map(imageSlotName).join(', ')}. Upload them again below.`;
}

@Component({
  selector: 'app-hotel-sheet-page',
  imports: [AdminHotelForm, AdminImageSlots, AdminSheet, OwnRatingField, RatingSummary, RouterLink, StatePanel],
  templateUrl: './hotel-sheet-page.html',
})
export class HotelSheetPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly hotelsApi = inject(AdminHotelsService);
  private readonly directoryRefresh = inject(AdminDirectoryRefresh);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sheet = viewChild.required(AdminSheet);
  private readonly hotelForm = viewChild(AdminHotelForm);

  protected readonly hotelId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  protected readonly isCreate = computed(() => this.hotelId() === null);
  protected readonly title = computed(() => (this.isCreate() ? 'New hotel' : 'Edit hotel'));

  protected readonly hotel = rxResource({
    params: () => this.hotelId() ?? undefined,
    stream: ({ params }) => this.hotelsApi.get(params),
  });
  protected readonly loadedHotel = computed<Hotel | null>(() => (this.hotel.hasValue() ? this.hotel.value() : null));

  protected readonly view = computed<SheetView>(() => {
    if (this.isCreate()) {
      return 'form';
    }
    const error = this.hotel.error();
    if (error) {
      return httpFailureOf(error)?.status === 404 ? 'not-found' : 'error';
    }
    return this.loadedHotel() === null ? 'loading' : 'form';
  });

  protected readonly rating = linkedSignal<Hotel | null, HotelRating | null>({
    source: this.loadedHotel,
    computation: (hotel) => hotel?.rating ?? null,
  });
  protected readonly ownRating = createOwnRating({
    hotelId: () => this.loadedHotel()?.id,
    saved: (summary) => {
      this.rating.set(summary);
      this.directoryRefresh.announce();
    },
  });

  protected readonly slots = linkedSignal<Hotel | null, readonly ImageSlotState[]>({
    source: this.loadedHotel,
    computation: (hotel) => (hotel === null ? emptyImageSlots() : imageSlotsOf(hotel)),
  });

  protected readonly saving = signal(false);
  protected readonly alert = signal<FormAlert | null>(this.readNotice());
  protected readonly formDirty = signal(false);
  protected readonly sheetDirty = computed(
    () => this.formDirty() || (this.isCreate() && this.slots().some((slot) => slot.pendingFile !== null)),
  );

  protected save(request: HotelRequest): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.alert.set(null);
    const id = this.hotelId();
    if (id === null) {
      this.create(request);
    } else {
      this.update(id, request);
    }
  }

  protected cancel(): void {
    this.sheet().requestClose();
  }

  protected retryLoad(): void {
    this.hotel.reload();
  }

  protected returnToDirectory(): void {
    void this.router.navigate(['/admin'], { queryParamsHandling: 'preserve', scroll: 'manual' });
  }

  protected chooseImage({ position, file }: ImageChoice): void {
    const problem = checkImageFile(file);
    if (problem !== null) {
      this.patchSlot(position, () => ({ error: problem, message: null }));
      return;
    }
    const id = this.hotelId();
    if (id === null) {
      this.patchSlot(position, () => ({ pendingFile: file, error: null, message: null }));
      return;
    }
    this.patchSlot(position, () => ({ status: 'uploading', error: null, message: null }));
    this.hotelsApi
      .uploadImage(id, position, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () =>
          this.patchSlot(position, (slot) => ({
            hasImage: true,
            version: slot.version + 1,
            status: 'idle',
            message: 'Image uploaded.',
          })),
        error: (error: unknown) => this.patchSlot(position, () => ({ status: 'idle', error: describeImageFailure(error) })),
      });
  }

  protected removeImage(position: ImagePosition): void {
    const id = this.hotelId();
    if (id === null) {
      return;
    }
    this.patchSlot(position, () => ({ status: 'removing', error: null, message: null }));
    this.hotelsApi
      .deleteImage(id, position)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.markRemoved(position),
        error: (error: unknown) =>
          httpFailureOf(error)?.status === 404
            ? this.markRemoved(position)
            : this.patchSlot(position, () => ({ status: 'idle', error: describeImageFailure(error) })),
      });
  }

  protected clearPending(position: ImagePosition): void {
    this.patchSlot(position, () => ({ pendingFile: null, error: null, message: null }));
  }

  private create(request: HotelRequest): void {
    const pending = this.slots().flatMap((slot) =>
      slot.pendingFile === null ? [] : [{ position: slot.position, file: slot.pendingFile }],
    );
    this.hotelsApi
      .create(request)
      .pipe(
        switchMap((hotel) => this.uploadAll(hotel.id, pending).pipe(map((failed) => ({ hotel, failed })))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ hotel, failed }) => this.completeCreate(hotel, failed),
        error: (error: unknown) => this.fail(error),
      });
  }

  private update(id: string, request: HotelRequest): void {
    this.hotelsApi
      .update(id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.directoryRefresh.announce(savedMessage);
          this.returnToDirectory();
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private uploadAll(id: string, pending: readonly PendingUpload[]): Observable<ImagePosition[]> {
    return from(pending).pipe(
      concatMap(({ position, file }) =>
        this.hotelsApi.uploadImage(id, position, file).pipe(
          map(() => null),
          catchError(() => of(position)),
        ),
      ),
      toArray(),
      map((results) => results.filter((position): position is ImagePosition => position !== null)),
    );
  }

  private completeCreate(hotel: Hotel, failed: readonly ImagePosition[]): void {
    this.directoryRefresh.announce(createdMessage);
    if (failed.length === 0) {
      this.returnToDirectory();
      return;
    }
    void this.router.navigate(['/admin', 'hotels', hotel.id, 'edit'], {
      queryParamsHandling: 'preserve',
      scroll: 'manual',
      state: { [noticeKey]: failedUploadsNotice(failed) },
    });
  }

  private fail(error: unknown): void {
    this.saving.set(false);
    if (httpFailureOf(error)?.status === 401) {
      return;
    }
    const failure = describeHotelFailure(error);
    this.alert.set({ message: failure.message, details: failure.details, retryable: failure.retryable });
    this.hotelForm()?.showServerErrors(failure.fieldErrors);
  }

  private markRemoved(position: ImagePosition): void {
    this.patchSlot(position, (slot) => ({
      hasImage: false,
      version: slot.version + 1,
      status: 'idle',
      message: 'Image removed.',
    }));
  }

  private patchSlot(position: ImagePosition, change: (slot: ImageSlotState) => Partial<ImageSlotState>): void {
    this.slots.update((slots) => slots.map((slot) => (slot.position === position ? { ...slot, ...change(slot) } : slot)));
  }

  private readNotice(): FormAlert | null {
    const notice: unknown = this.router.currentNavigation()?.extras.state?.[noticeKey];
    return typeof notice === 'string' ? { message: notice, details: [], retryable: false } : null;
  }
}
