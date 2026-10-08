import { launchVerdict, type Finding, type Gates } from './solution';

const ready: Gates = {
  anglesRun: ['features', 'bugs', 'performance', 'security'],
  guardrailsWritten: true,
  rollbackTested: true,
};

test('all four angles, no blockers and both gates: launch', () => {
  const minors: Finding[] = [
    { angle: 'bugs', severity: 'minor', proof: 'Long names wrap oddly: screenshot' },
    { angle: 'performance', severity: 'minor', proof: '' },
  ];
  expect(launchVerdict(minors, ready)).toEqual({ decision: 'launch', reasons: [] });
});

test('several blockers each give a reason, in the order found', () => {
  const findings: Finding[] = [
    { angle: 'security', severity: 'blocker', proof: 'Signed out, GET /api/bookings returns all' },
    { angle: 'bugs', severity: 'blocker', proof: '' },
  ];
  expect(launchVerdict(findings, ready).reasons).toEqual(['blocker: security', 'needs proof: bugs']);
});

test('a proven blocker holds the launch', () => {
  const leak: Finding = { angle: 'security', severity: 'blocker', proof: 'GET /api/bookings/42 as guest b' };
  expect(launchVerdict([leak], ready)).toEqual({ decision: 'hold', reasons: ['blocker: security'] });
});

test('a blocker without proof holds it until someone reproduces it', () => {
  const vague: Finding = { angle: 'performance', severity: 'blocker', proof: '   ' };
  expect(launchVerdict([vague], ready)).toEqual({ decision: 'hold', reasons: ['needs proof: performance'] });
});

test('an angle nobody attacked holds it, in the order of ANGLES', () => {
  const gates: Gates = { ...ready, anglesRun: ['bugs', 'features'] };
  expect(launchVerdict([], gates).reasons).toEqual(['not attacked: performance', 'not attacked: security']);
});

test('missing guardrails and an untested rollback each hold it', () => {
  const gates: Gates = { ...ready, guardrailsWritten: false, rollbackTested: false };
  expect(launchVerdict([], gates)).toEqual({
    decision: 'hold',
    reasons: ['no guardrails', 'rollback not tested'],
  });
});

test('reasons come in order: angles, then findings, then gates', () => {
  const gates: Gates = { ...ready, anglesRun: ['features', 'bugs', 'performance'], rollbackTested: false };
  const findings: Finding[] = [
    { angle: 'features', severity: 'blocker', proof: 'Cancel button does nothing: recording' },
    { angle: 'bugs', severity: 'minor', proof: 'Typo on the receipt' },
  ];
  expect(launchVerdict(findings, gates).reasons).toEqual([
    'not attacked: security',
    'blocker: features',
    'rollback not tested',
  ]);
});
