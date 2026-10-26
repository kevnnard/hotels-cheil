import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { StatePanel } from '../../../shared/ui/state-panel';
import { HotelCatalogService } from '../data/hotel-catalog.service';
import { sampleAmenities, sampleManager, sampleQuote } from '../data/hotel-detail-content';
import { formatCityRegion, formatLocation } from '../data/hotel-location';
import { HotelGallery } from '../ui/hotel-gallery';
import { RatingSummary } from '../ui/rating-summary';
import { ReservationCard } from '../ui/reservation-card';
import { SuitesShowcase } from '../ui/suites-showcase';
import { HotelRatingPanel } from './hotel-rating-panel';

interface HotelFact {
  label: string;
  value: string | null;
}

function joinPresent(parts: (string | null)[], separator: string): string {
  return parts.filter((part): part is string => !!part).join(separator);
}

@Component({
  selector: 'app-hotel-detail-page',
  imports: [RouterLink, HotelGallery, HotelRatingPanel, RatingSummary, ReservationCard, StatePanel, SuitesShowcase],
  templateUrl: './hotel-detail-page.html',
})
export class HotelDetailPage {
  private readonly catalog = inject(HotelCatalogService);
  private readonly route = inject(ActivatedRoute);

  private readonly hotelId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  protected readonly quote = sampleQuote;
  protected readonly amenities = sampleAmenities;
  protected readonly manager = sampleManager;
  protected readonly managerInitials = sampleManager.name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('');

  protected readonly hotel = rxResource({
    params: () => this.hotelId(),
    stream: ({ params }) => this.catalog.get(params),
  });

  protected readonly rating = linkedSignal(() => this.hotel.value()?.rating ?? null);

  protected readonly notFound = computed(() => {
    const error = this.hotel.error();
    const cause = error instanceof HttpErrorResponse ? error : error?.cause;
    return cause instanceof HttpErrorResponse && cause.status === 404;
  });

  protected readonly facts = computed(() => {
    const hotel = this.hotel.value();
    if (!hotel) {
      return [];
    }
    const { address, contact } = hotel;
    const reach: HotelFact = contact.phone
      ? { label: 'Phone', value: contact.phone }
      : { label: 'Website', value: contact.website };
    const facts: HotelFact[] = [
      { label: 'Location', value: formatCityRegion(address) },
      { label: 'Country', value: address.country },
      { label: 'Postal code', value: address.postalCode },
      reach,
    ];
    return facts.filter((fact): fact is { label: string; value: string } => !!fact.value);
  });

  protected readonly location = computed(() => {
    const address = this.hotel.value()?.address;
    return address ? formatCityRegion(address) : '';
  });

  protected readonly cityCountry = computed(() => {
    const address = this.hotel.value()?.address;
    return address ? formatLocation(address) : '';
  });

  protected readonly addressLines = computed(() => {
    const address = this.hotel.value()?.address;
    if (!address) {
      return [];
    }
    const locality = joinPresent([joinPresent([address.city, address.region], ', '), address.postalCode], ' ');
    return [address.street, locality, address.country].filter((line): line is string => !!line);
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
