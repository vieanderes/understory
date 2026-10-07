function talkOrder(lines, start) {
  const next = new Map();
  for (const line of lines) {
    if (!line.includes('-->')) continue;
    const [from, rest] = line.split('-->').map((part) => part.trim());
    // A label sits between pipes right after the arrow: api -->|order id| queue
    const to = rest.replace(/^\|[^|]*\|/, '').trim();
    if (!next.has(from)) next.set(from, []);
    next.get(from).push(to);
  }
  const order = [];
  const visit = (box) => {
    if (order.includes(box)) return;
    order.push(box);
    // Deep before wide, so the main path is told before any side branch.
    for (const to of next.get(box) ?? []) visit(to);
  };
  visit(start);
  return order;
}
