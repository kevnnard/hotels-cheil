import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { StatePanel } from '../../../shared/ui/state-panel';
import { HotelCatalogService } from '../data/hotel-catalog.service';
import { formatCityRegion } from '../data/hotel-location';
import { HotelImageView } from '../ui/hotel-image-view';
import { RatingSummary } from '../ui/rating-summary';

@Component({
  selector: 'app-hotel-detail-page',
  imports: [RouterLink, HotelImageView, RatingSummary, StatePanel],
  templateUrl: './hotel-detail-page.html',
})
export class HotelDetailPage {
  private readonly catalog = inject(HotelCatalogService);
  private readonly route = inject(ActivatedRoute);

  private readonly hotelId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  protected readonly hotel = rxResource({
    params: () => this.hotelId(),
    stream: ({ params }) => this.catalog.get(params),
  });

  protected readonly notFound = computed(() => {
    const error = this.hotel.error();
    const cause = error instanceof HttpErrorResponse ? error : error?.cause;
    return cause instanceof HttpErrorResponse && cause.status === 404;
  });

  protected readonly facts = computed(() => {
    const address = this.hotel.value()?.address;
    if (!address) {
      return [];
    }
    return [
      { label: 'Address', value: address.street },
      { label: 'City', value: address.city },
      { label: 'Region', value: address.region },
      { label: 'Country', value: address.country },
      { label: 'Postal code', value: address.postalCode },
    ].filter((fact): fact is { label: string; value: string } => !!fact.value);
  });

  protected readonly location = computed(() => {
    const address = this.hotel.value()?.address;
    return address ? formatCityRegion(address) : '';
  });

  protected readonly hasContact = computed(() => {
    const contact = this.hotel.value()?.contact;
    return !!contact && !!(contact.phone || contact.email || contact.website);
  });

  protected isWebAddress(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  protected retry(): void {
    this.hotel.reload();
  }
}
