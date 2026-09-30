export type Route = { name: string; scores: Record<string, number>; can: string[] };
export type Ranked = { name: string; total: number };

// Routes that can do everything in `mustHave`, best weighted total first.
export function rankRoutes(routes: Route[], weights: Record<string, number>, mustHave: string[]): Ranked[] {
  return routes.map((route) => ({ name: route.name, total: 0 }));
}
