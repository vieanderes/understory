export type Route = { name: string; scores: Record<string, number>; can: string[] };
export type Ranked = { name: string; total: number };

// Routes that can do everything in `mustHave`, best weighted total first.
export function rankRoutes(routes: Route[], weights: Record<string, number>, mustHave: string[]): Ranked[] {
  const possible = routes.filter((route) => mustHave.every((need) => route.can.includes(need)));
  const ranked = possible.map((route) => {
    let total = 0;
    for (const [criterion, weight] of Object.entries(weights)) {
      const score = route.scores[criterion];
      if (score === undefined || score < 1 || score > 5) {
        throw new Error(`${route.name} needs a score from 1 to 5 for ${criterion}`);
      }
      total += score * weight;
    }
    return { name: route.name, total };
  });
  return ranked.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
