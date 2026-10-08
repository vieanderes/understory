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
  const reasons = [
    ...ANGLES.filter((angle) => !gates.anglesRun.includes(angle)).map((angle) => `not attacked: ${angle}`),
    ...findings
      .filter((finding) => finding.severity === 'blocker')
      .map((finding) =>
        finding.proof.trim() === '' ? `needs proof: ${finding.angle}` : `blocker: ${finding.angle}`,
      ),
  ];
  if (!gates.guardrailsWritten) reasons.push('no guardrails');
  if (!gates.rollbackTested) reasons.push('rollback not tested');
  return { decision: reasons.length === 0 ? 'launch' : 'hold', reasons };
}
