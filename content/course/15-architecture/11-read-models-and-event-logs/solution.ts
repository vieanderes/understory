export type StockEvent = {
  seq: number;
  type: 'StockReceived' | 'StockShipped';
  sku: string;
  qty: number;
};

// State is never stored. It is the fold of every event up to a point in the log.
export function replay(events: StockEvent[], upToSeq: number): Record<string, number> {
  const stock: Record<string, number> = {};
  const applied: number[] = [];
  for (const event of events) {
    if (event.seq > upToSeq || applied.includes(event.seq)) continue;
    applied.push(event.seq);
    const change = event.type === 'StockReceived' ? event.qty : -event.qty;
    stock[event.sku] = (stock[event.sku] ?? 0) + change;
  }
  return stock;
}
