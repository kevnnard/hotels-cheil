export interface ManifestoPrinciple {
  readonly title: string;
  readonly text: string;
}

export interface ManifestoImage {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface ManifestoTile {
  readonly kind: 'photo' | 'stat';
  readonly headline: string;
  readonly text: string;
  readonly image?: ManifestoImage;
}

export interface Manifesto {
  readonly eyebrow: string;
  readonly headingLines: readonly string[];
  readonly intro: string;
  readonly principles: readonly ManifestoPrinciple[];
  readonly tiles: readonly ManifestoTile[];
}

export const manifesto: Manifesto = {
  eyebrow: 'Brand manifesto',
  headingLines: ['Discover.', 'Experience.', 'Transcend.'],
  intro:
    'AUREA is not a hotel chain: it is a consortium of hyper-specific refuges designed to slow the perception of time through geometry, natural light and acoustic stillness.',
  principles: [
    {
      title: 'Curation without algorithms',
      text: 'Only 1 in 40 audited properties enters the AUREA registry.',
    },
    {
      title: 'Invisible presence',
      text: 'Service anticipates without interrupting; butlers trained in discreet etiquette.',
    },
    {
      title: 'Lasting resonance',
      text: "Biophilic design and sensory comfort that reset the guest's biorhythms.",
    },
  ],
  tiles: [
    {
      kind: 'photo',
      headline: 'Raw material',
      text: 'Volcanic stone and organic linen',
      image: {
        src: '/manifesto/raw-material.jpg',
        alt: 'Stone corridor with arched window',
        width: 805,
        height: 1000,
      },
    },
    { kind: 'stat', headline: '18 dB', text: 'Average sound insulation in every residential suite' },
    { kind: 'stat', headline: '100%', text: 'Geothermal hot springs, never chemically treated' },
    {
      kind: 'photo',
      headline: 'Digital detox protocol',
      text: 'Optional',
      image: {
        src: '/manifesto/digital-detox.jpg',
        alt: 'Person meditating on a deck at sunset',
        width: 805,
        height: 1000,
      },
    },
  ],
};
