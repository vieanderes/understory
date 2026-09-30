export interface Order { email: string; totalPence: number }
export interface Payments { charge(amountPence: number): Promise<{ ok: boolean }> }
export interface Mail { send(to: string, text: string): Promise<void> }

export async function checkout(order: Order, payments: Payments, mail: Mail) {
  const result = await payments.charge(order.totalPence);
  if (!result.ok) return { paid: false };
  await mail.send(order.email, 'Thanks for your order');
  return { paid: true };
}

const order = { email: 'sam@example.com', totalPence: 1299 };

export async function testDeclineSendsNothing() {
  const payments = { charge: async () => ({ ok: false }) };
  const sent: string[] = [];
  const mail = { send: async (to: string) => { sent.push(to); } };
  const result = await checkout(order, payments, mail);
  expect(result.paid).toBe(false);
  expect(sent).toEqual([]);
}

export async function testSuccessChargesAndSends() {
  const charged: number[] = [];
  const payments = {
    charge: async (amount: number) => {
      charged.push(amount);
      return { ok: true };
    },
  };
  const sent: string[] = [];
  const mail = { send: async (to: string) => { sent.push(to); } };
  const result = await checkout(order, payments, mail);
  expect(result.paid).toBe(true);
  expect(charged).toEqual([1299]);
  expect(sent).toEqual(['sam@example.com']);
}
