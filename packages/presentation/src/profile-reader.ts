export interface PresentationProfileSummary {
  displayName: string;
  publicUrl: string | null;
}

export interface PresentationProfileReaderPort {
  get(): Promise<PresentationProfileSummary>;
}

export const defaultPresentationProfileSummary: PresentationProfileSummary = {
  displayName: 'Lingcoo Frame',
  publicUrl: null,
};

export function createNoopPresentationProfileReader(): PresentationProfileReaderPort {
  return {
    async get() {
      return defaultPresentationProfileSummary;
    },
  };
}
