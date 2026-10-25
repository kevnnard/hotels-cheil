export interface SampleQuote {
  readonly text: string;
  readonly attribution: string;
}

export interface SampleSuite {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly features: readonly string[];
}

export interface SampleAmenity {
  readonly title: string;
  readonly description: string;
  readonly iconPath: string;
}

export interface SamplePerk {
  readonly label: string;
  readonly value: 'Complimentary' | 'Included';
}

export interface SampleManager {
  readonly name: string;
  readonly role: string;
}

export const sampleQuote: SampleQuote = {
  text: 'We added nothing for show. We cleared the way so that light, stone and stillness could shape the stay on their own.',
  attribution: 'Lead architect',
};

export const sampleSuites: readonly SampleSuite[] = [
  {
    id: 'signature-suite',
    name: 'Signature Suite',
    description:
      'The most generous room in the house, with a separate sitting area, tall windows that frame the view and a deep soaking tub set in natural stone.',
    features: ['Separate sitting area', 'King-size bed in organic linen', 'Soaking tub in natural stone', 'Private butler on request'],
  },
  {
    id: 'garden-villa',
    name: 'Garden Villa',
    description:
      'A quiet villa opening onto its own planted garden, with a shaded terrace, an outdoor shower and a plunge pool for slow afternoons.',
    features: ['Private planted garden', 'Shaded outdoor terrace', 'Heated plunge pool', 'Outdoor rain shower'],
  },
  {
    id: 'terrace-loggia',
    name: 'Terrace Loggia',
    description:
      'A light-filled room behind a row of open arches, with a wide terrace for breakfast outside and a reading corner by the fireplace.',
    features: ['Arched private terrace', 'Queen-size bed in organic linen', 'Reading corner and fireplace', 'Breakfast served outside'],
  },
];

export const sampleAmenities: readonly SampleAmenity[] = [
  {
    title: 'Outdoor pool',
    description: 'A calm pool kept with natural salts, open from sunrise to sunset.',
    iconPath: 'M2 19c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M8 15V6a2 2 0 0 1 4 0M16 15V6a2 2 0 0 0-4 0M8 10h8',
  },
  {
    title: 'Seasonal kitchen',
    description: 'A short daily menu built around local produce and the season.',
    iconPath: 'M3 14a6 6 0 1 0 12 0 6 6 0 1 0-12 0M15 14h6M7 3c0 1 1 1 1 2s-1 1-1 2M11 3c0 1 1 1 1 2s-1 1-1 2',
  },
  {
    title: 'Boat transfer',
    description: 'Short crossings to nearby coves with a private skipper.',
    iconPath: 'M2 17h20l-2.5 4h-15L2 17ZM12 3v14M12 4l6 10h-6',
  },
  {
    title: 'Spa rituals',
    description: 'Steam, massage and quiet rooms for a slower pace.',
    iconPath: 'M12 21c-4.5 0-8-3-8-8 4 0 8 3 8 8Zm0 0c4.5 0 8-3 8-8-4 0-8 3-8 8Zm0 0v-8M12 13c-2-2-2-6 0-9 2 3 2 7 0 9Z',
  },
  {
    title: 'Airport transfer',
    description: 'A private car waits on arrival and returns you on departure.',
    iconPath: 'M2 21h20M3 12l2-1 3 2 3-1-3-6 2-1 6 5 4-1a1.5 1.5 0 0 1 .8 2.9L5 16Z',
  },
  {
    title: 'Evening bar',
    description: 'Classic cocktails and a short list of local wines at dusk.',
    iconPath: 'M5 4h14l-7 8-7-8ZM12 12v8M8 20h8M7 6.5h10',
  },
];

export const sampleReservationPerks: readonly SamplePerk[] = [
  { label: 'Daily artisanal breakfast', value: 'Complimentary' },
  { label: 'Private arrival transfer', value: 'Complimentary' },
  { label: 'Concierge desk, day and night', value: 'Included' },
];

export const sampleGuestOptions: readonly number[] = [1, 2, 3, 4];

export const sampleManager: SampleManager = {
  name: 'Alex Morgan',
  role: 'General Manager',
};
