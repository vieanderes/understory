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
  // Copied from vendor A's adapter. It promises more than vendor B can do.
  return {
    capabilities: { updatedSince: true, seatCounts: true, webhooks: false },
    async listScreenings() {
      const shows = await client.fetchShows();
      return shows.map((show) => ({
        remoteId: String(show.show_id),
        film: show.title,
        startsAt: show.start_utc,
        seatsLeft: 0,
        custom: {},
        raw: show,
      }));
    },
  };
}
