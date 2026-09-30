export type Load = {
  dailyUsers: number;
  actionsPerUser: number;
  bytesPerAction: number;
  retentionDays: number;
  replicas: number;
  peakFactor: number;
};

export type Estimate = { averagePerSecond: number; peakPerSecond: number; storageBytes: number };

const SECONDS_PER_DAY = 86_400;

export function estimate(load: Load): Estimate {
  const perDay = load.dailyUsers * load.actionsPerUser;
  const perSecond = perDay / SECONDS_PER_DAY;
  return {
    averagePerSecond: Math.ceil(perSecond),
    peakPerSecond: Math.ceil(perSecond * load.peakFactor),
    storageBytes: perDay * load.bytesPerAction * load.retentionDays * load.replicas,
  };
}
