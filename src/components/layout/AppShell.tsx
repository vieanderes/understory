import type { NavPath } from './nav';
import { PhoneBar, Sidebar, TabBar } from './PrimaryNav';

/**
 * The frame around every learner-facing page. On desktop, a rail on the ground and the page
 * on a raised panel beside it, the way a tool sits on a desk. On phones, a slim bar above and
 * four places in a tab bar below, so `main` keeps clear of it.
 */
export function AppShell({
  children,
  paths = [],
}: {
  children: React.ReactNode;
  paths?: readonly NavPath[];
}) {
  return (
    <div className="bg-bg text-fg flex min-h-dvh">
      <Sidebar paths={paths} />
      <div className="flex min-w-0 flex-1 flex-col md:py-1 md:pr-1">
        <PhoneBar />
        <main
          id="content"
          className="md:bg-surface md:border-border md:rounded-panel md:shadow-edge flex-1 pt-3 pb-12 md:border md:pt-6 md:pb-8"
        >
          <div className="frame">{children}</div>
        </main>
        <TabBar />
      </div>
    </div>
  );
}
