export type Load = {
  dailyUsers: number;
  actionsPerUser: number;
  bytesPerAction: number;
  retentionDays: number;
  replicas: number;
  peakFactor: number;
};

export type Estimate = { averagePerSecond: number; peakPerSecond: number; storageBytes: number };

export function estimate(load: Load): Estimate {
  // Actions per day first. Then per second, the peak, and the stored bytes.
  return { averagePerSecond: 0, peakPerSecond: 0, storageBytes: 0 };
}
