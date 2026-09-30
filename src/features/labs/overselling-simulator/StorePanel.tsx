import type { World } from '@/core/labs/overselling-simulator';
import { cn } from '@/lib/cn';

interface StorePanelProps {
  world: World;
  className?: string;
}

const nameOf = (world: World, id: number | null): string | null =>
  id === null ? null : (world.actors.find((actor) => actor.id === id)?.name ?? null);

function Reading({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rule-t min-w-0 pt-1">
      <dt className="t-label truncate">{label}</dt>
      <dd className="t-figure truncate text-lg">
        {value}
        {note ? <span className="text-muted pl-1 text-sm">{note}</span> : null}
      </dd>
    </div>
  );
}

/** The one `events` row and the holds beside it: what every actor is reading and writing. */
export function StorePanel({ world, className }: StorePanelProps) {
  const { store } = world;
  const holder = nameOf(world, store.lock.holder);
  const queue = store.lock.queue.map((id) => nameOf(world, id)).join(' then ');

  return (
    <section aria-label="Store" className={cn('flex min-w-0 flex-col gap-1', className)}>
      <h2 className="t-label">Store</h2>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
        <Reading label="Sold" value={String(store.sold)} note={`of ${store.capacity}`} />
        <Reading label="Held" value={String(store.held)} />
        <Reading label="Version" value={`v${store.version}`} />
        <Reading
          label="Row lock"
          value={holder ?? 'free'}
          note={queue.length > 0 ? `queue: ${queue}` : undefined}
        />
        {store.pendingSold === null ? null : (
          <div className="rule-t col-span-2 min-w-0 pt-1">
            <dt className="t-label">Written, not committed</dt>
            <dd className="t-figure text-lg">
              {`sold = ${store.pendingSold}`}
              <span className="text-muted pl-1 text-sm">
                {`${holder ?? 'Someone'} holds the row until COMMIT`}
              </span>
            </dd>
          </div>
        )}
      </dl>
      {store.holds.length > 0 ? (
        <table className="mt-1 w-full text-sm">
          <caption className="t-label pb-0.5 text-left">Holds</caption>
          <thead>
            <tr className="rule-b text-muted">
              <th scope="col" className="py-0.5 text-left font-normal">
                Owner
              </th>
              <th scope="col" className="py-0.5 text-right font-normal">
                Qty
              </th>
              <th scope="col" className="py-0.5 text-right font-normal">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {store.holds.map((hold) => (
              <tr key={hold.id} className="rule-b" data-hold={hold.id}>
                <th scope="row" className="py-0.5 text-left font-normal">
                  {hold.owner}
                </th>
                <td className="t-figure py-0.5 text-right">{hold.qty}</td>
                <td className="t-figure py-0.5 text-right">
                  {hold.overdue ? `${hold.status}, overdue` : hold.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
