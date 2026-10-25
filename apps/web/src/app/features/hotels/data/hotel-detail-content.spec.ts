import {
  sampleAmenities,
  sampleGuestOptions,
  sampleManager,
  sampleQuote,
  sampleReservationPerks,
  sampleSuites,
} from './hotel-detail-content';

const everything = JSON.stringify([
  sampleAmenities,
  sampleGuestOptions,
  sampleManager,
  sampleQuote,
  sampleReservationPerks,
  sampleSuites,
]);

describe('hotel detail sample content', () => {
  it('offers three generic suites with a description and check-mark features but no price', () => {
    expect(sampleSuites.map((suite) => suite.name)).toEqual(['Signature Suite', 'Garden Villa', 'Terrace Loggia']);
    for (const suite of sampleSuites) {
      expect(suite.description.length).toBeGreaterThan(0);
      expect(suite.features.length).toBeGreaterThanOrEqual(4);
    }
    expect(JSON.stringify(sampleSuites)).not.toMatch(/\$|€|USD|per night/);
  });

  it('lists six amenities, each with a title, a one-line description and a local icon path', () => {
    expect(sampleAmenities.length).toBe(6);
    for (const amenity of sampleAmenities) {
      expect(amenity.title.length).toBeGreaterThan(0);
      expect(amenity.description).not.toContain('\n');
      expect(amenity.iconPath).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
    }
  });

  it('attributes the quote to a generic role and names a sample manager', () => {
    expect(sampleQuote.attribution).toBe('Lead architect');
    expect(sampleManager).toEqual({ name: 'Alex Morgan', role: 'General Manager' });
  });

  it('offers one to four guests and static complimentary perks', () => {
    expect(sampleGuestOptions).toEqual([1, 2, 3, 4]);
    expect(sampleReservationPerks.length).toBeGreaterThan(0);
    for (const perk of sampleReservationPerks) {
      expect(['Complimentary', 'Included']).toContain(perk.value);
    }
  });

  it('contains no remote address, year, availability or certification claim', () => {
    expect(everything).not.toMatch(/https?:|\/\/|www\./);
    expect(everything).not.toMatch(/\b1[5-9]\d\d\b|\b20\d\d\b/);
    for (const forbidden of ['remaining', 'available', 'Maison', 'certified', 'Certified', 'Book', 'book', 'Reserv', 'reserv']) {
      expect(everything).not.toContain(forbidden);
    }
  });
});
