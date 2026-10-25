import { Component } from '@angular/core';
import { manifesto } from '../data/manifesto';

@Component({
  selector: 'app-manifesto-section',
  host: { class: 'block' },
  template: `
    <section
      aria-labelledby="manifesto-heading"
      class="relative w-full overflow-hidden bg-primary px-margin-mobile py-space-xl text-surface md:px-margin-tablet lg:px-margin-desktop"
    >
      <div
        data-testid="manifesto-layout"
        class="mx-auto grid max-w-360 grid-cols-1 items-center gap-gutter-desktop lg:grid-cols-2"
      >
        <div class="flex flex-col gap-space-md">
          <span data-testid="manifesto-eyebrow" class="text-label-sm uppercase text-secondary-container">{{
            content.eyebrow
          }}</span>
          <h2
            id="manifesto-heading"
            class="font-serif text-display-md-mobile tracking-tight text-surface md:text-display-md"
          >
            @for (line of content.headingLines; track line) {
              <span data-testid="manifesto-heading-line" class="block">{{ line }}</span>
            }
          </h2>
          <p data-testid="manifesto-intro" class="max-w-md text-body-lg font-light text-surface/80">
            {{ content.intro }}
          </p>
          <ol data-testid="manifesto-principles" class="flex flex-col gap-space-sm">
            @for (principle of content.principles; track principle.title; let index = $index) {
              <li class="flex items-start gap-space-sm rounded-lg bg-surface/5 p-space-sm">
                <span data-testid="principle-number" class="font-mono text-headline-sm font-bold text-secondary-container"
                  >0{{ index + 1 }}</span
                >
                <div>
                  <h3 class="text-title-md text-surface">{{ principle.title }}</h3>
                  <p class="text-body-sm text-surface/70">{{ principle.text }}</p>
                </div>
              </li>
            }
          </ol>
        </div>
        <ul data-testid="manifesto-tiles" class="grid grid-cols-1 gap-space-md lg:grid-cols-2">
          @for (tile of content.tiles; track tile.headline) {
            <li
              data-testid="manifesto-tile"
              [attr.data-kind]="tile.kind"
              class="relative flex h-56 flex-col justify-between overflow-hidden rounded-xl p-space-md"
              [class]="
                tile.image
                  ? 'bg-primary text-surface shadow-2xl'
                  : tile.kind === 'photo'
                    ? 'bg-linear-to-br from-primary-container to-primary text-on-primary-container shadow-2xl'
                    : 'bg-surface-container-high/10 backdrop-blur-md'
              "
            >
              @if (tile.image; as image) {
                <img
                  [src]="image.src"
                  [alt]="image.alt"
                  [attr.width]="image.width"
                  [attr.height]="image.height"
                  loading="lazy"
                  class="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  data-testid="tile-overlay"
                  class="absolute inset-0 bg-linear-to-t from-primary/90 via-primary/30 to-transparent"
                ></div>
                <svg
                  viewBox="0 0 24 24"
                  class="relative h-10 w-10 text-secondary-container"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  aria-hidden="true"
                >
                  <path
                    d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M12 10h.01M15 10h.01"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <div class="relative">
                  <p data-testid="tile-headline" class="text-label-sm uppercase text-secondary-container">
                    {{ tile.headline }}
                  </p>
                  <p data-testid="tile-text" class="text-title-md text-surface">{{ tile.text }}</p>
                </div>
              } @else if (tile.kind === 'photo') {
                <svg
                  viewBox="0 0 24 24"
                  class="h-10 w-10 text-secondary-container"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  aria-hidden="true"
                >
                  <path
                    d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M12 10h.01M15 10h.01"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <div>
                  <p data-testid="tile-headline" class="text-label-sm uppercase text-secondary-container">
                    {{ tile.headline }}
                  </p>
                  <p data-testid="tile-text" class="text-title-md text-surface">{{ tile.text }}</p>
                </div>
              } @else {
                <div></div>
                <div>
                  <p data-testid="tile-headline" class="font-serif text-display-md-mobile text-surface md:text-display-md">
                    {{ tile.headline }}
                  </p>
                  <p data-testid="tile-text" class="text-body-sm text-surface/70">{{ tile.text }}</p>
                </div>
              }
            </li>
          }
        </ul>
      </div>
    </section>
  `,
})
export class ManifestoSection {
  protected readonly content = manifesto;
}
