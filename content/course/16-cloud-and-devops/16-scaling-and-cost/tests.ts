import { capacityPlan } from './solution';

const costs = { pencePerInstance: 1200, ordersPerMonth: 24000 };

test('peak plus headroom, divided by the measured rate, rounded up', () => {
  const plan = capacityPlan({ peakRps: 400, rpsPerInstance: 145, headroomPercent: 30 }, costs);
  expect(plan.instances).toBe(4);
  expect(plan.monthlyPence).toBe(4800);
});

test('cost per order is the monthly cost over the orders', () => {
  const plan = capacityPlan({ peakRps: 400, rpsPerInstance: 145, headroomPercent: 30 }, costs);
  expect(plan.pencePerOrder).toBeCloseTo(0.2, 5);
});

test('a load that fits exactly needs no extra instance', () => {
  const plan = capacityPlan({ peakRps: 300, rpsPerInstance: 100, headroomPercent: 0 }, costs);
  expect(plan.instances).toBe(3);
});

test('a tiny load still gets two instances', () => {
  const plan = capacityPlan({ peakRps: 10, rpsPerInstance: 145, headroomPercent: 30 }, costs);
  expect(plan.instances).toBe(2);
  expect(plan.monthlyPence).toBe(2400);
});

test('no orders yet gives a cost per order of 0, not Infinity', () => {
  const plan = capacityPlan(
    { peakRps: 10, rpsPerInstance: 145, headroomPercent: 30 },
    { pencePerInstance: 1200, ordersPerMonth: 0 },
  );
  expect(plan.pencePerOrder).toBe(0);
});

test('an unmeasured instance rate throws', () => {
  expect(() =>
    capacityPlan({ peakRps: 400, rpsPerInstance: 0, headroomPercent: 30 }, costs),
  ).toThrow();
});
