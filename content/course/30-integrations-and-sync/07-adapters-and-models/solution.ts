// The common model every adapter returns, whichever vendor is behind it.
export interface Screening {
  remoteId: string;
  film: string;
  startsAt: string;
  seatsLeft: number | null;
  custom: Record<string, string>;
  raw: unknown;
}

export interface Capabilities {
  updatedSince: boolean;
  seatCounts: boolean;
  webhooks: boolean;
}

export interface ListingsSource {
  readonly capabilities: Capabilities;
  listScreenings(options?: { updatedSince?: string }): Promise<Screening[]>;
}

export class UnsupportedError extends Error {
  readonly feature: keyof Capabilities;
  constructor(feature: keyof Capabilities) {
    super(`This vendor does not support ${feature}`);
    this.feature = feature;
  }
}

// Vendor B's own client. It has no filters and never sends seat counts.
export interface RawShow {
  show_id: number;
  title: string;
  start_utc: string;
  fields: Record<string, string>;
}

export interface VendorBClient {
  fetchShows(): Promise<RawShow[]>;
}

// Per connection: the cinema's own vendor field, and the name you give it.
export type FieldMap = Record<string, string>;

export function vendorBSource(client: VendorBClient, fieldMap: FieldMap): ListingsSource {
  // Declared honestly, so the sync and the pages can adapt instead of being misled.
  const capabilities: Capabilities = { updatedSince: false, seatCounts: false, webhooks: false };
  return {
    capabilities,
    async listScreenings(options) {
      // Quietly returning everything would let a caller believe it ran a delta.
      if (options?.updatedSince !== undefined) throw new UnsupportedError('updatedSince');
      const shows = await client.fetchShows();
      return shows.map((show) => {
        const custom: Record<string, string> = {};
        for (const [theirs, ours] of Object.entries(fieldMap)) {
          const value = show.fields[theirs];
          if (value !== undefined) custom[ours] = value;
        }
        // null, not 0: this vendor doesn't say, which is different from sold out.
        return { remoteId: String(show.show_id), film: show.title, startsAt: show.start_utc, seatsLeft: null, custom, raw: show };
      });
    },
  };
}
