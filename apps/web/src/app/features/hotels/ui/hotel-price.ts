import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { priceDigits } from '../data/hotel-price';
import { HotelPricing } from '../data/hotel.models';

@Component({
  selector: 'app-hotel-price',
  imports: [CurrencyPipe],
  template: `
    @let price = pricing();
    <p class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-on-surface-variant">
      @if (offer(); as discount) {
        <s data-testid="price-original" class="text-body-sm"><span class="sr-only">Original price </span>{{ price.nightlyRate | currency: price.currency : 'symbol' : digits(price.nightlyRate) }}</s>
        <span data-testid="price-current" [class]="amountClasses()"><span class="sr-only"> Discounted price </span>{{ discount.rate | currency: price.currency : 'symbol' : digits(discount.rate) }}</span>
      } @else {
        <span data-testid="price-current" [class]="amountClasses()">{{ price.nightlyRate | currency: price.currency : 'symbol' : digits(price.nightlyRate) }}</span>
      }
      <span class="text-body-sm"> per night</span>
      @if (showBadge() && offer(); as discount) {
        <span data-testid="price-discount" class="rounded bg-secondary-container px-1.5 py-0.5 text-label-sm font-bold text-on-secondary-fixed"> -{{ discount.percent }}%</span>
      }
    </p>
  `,
})
export class HotelPrice {
  readonly pricing = input.required<HotelPricing>();
  readonly size = input<'md' | 'lg'>('md');
  readonly showBadge = input(true);

  protected readonly offer = computed(() => {
    const { discountPercent, discountedNightlyRate } = this.pricing();
    return discountPercent !== null && discountedNightlyRate !== null
      ? { percent: discountPercent, rate: discountedNightlyRate }
      : null;
  });

  protected readonly amountClasses = computed(() =>
    this.size() === 'lg' ? 'font-serif text-headline-md text-primary' : 'font-serif text-headline-sm text-primary',
  );

  protected digits(amount: number): string {
    return priceDigits(amount);
  }
}
