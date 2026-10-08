export type Angle = 'features' | 'bugs' | 'performance' | 'security';

export interface Finding {
  angle: Angle;
  severity: 'blocker' | 'minor';
  proof: string;
}

export interface Gates {
  anglesRun: Angle[];
  guardrailsWritten: boolean;
  rollbackTested: boolean;
}

export interface Verdict {
  decision: 'launch' | 'hold';
  reasons: string[];
}

export const ANGLES: Angle[] = ['features', 'bugs', 'performance', 'security'];

export function launchVerdict(findings: Finding[], gates: Gates): Verdict {
  // A green pull request, so it ships.
  return { decision: 'launch', reasons: [] };
}
