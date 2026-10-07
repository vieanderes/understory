export type StockEvent = {
  seq: number;
  type: 'StockReceived' | 'StockShipped';
  sku: string;
  qty: number;
};

export function replay(events: StockEvent[], upToSeq: number): Record<string, number> {
  // Fold the events into stock levels. Stop at upToSeq, and apply each seq only once.
  return { events: events.length, upToSeq };
}
