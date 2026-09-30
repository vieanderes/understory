import { openShop, testAddingToBasket } from './solution';

async function failureOf(page) {
  try {
    await testAddingToBasket(page);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function passesOn(delayMs, where) {
  const failure = await failureOf(openShop(delayMs));
  if (failure !== null) throw new Error(`Failed on ${where}: ${failure}`);
}

test('passes when the basket updates after 10 ms', async () => {
  await passesOn(10, 'a quick page');
});

test('passes when the basket updates after 60 ms', async () => {
  await passesOn(60, 'a normal page');
});

test('passes on a slow CI machine, where it takes 350 ms', async () => {
  await passesOn(350, 'a slow page. A fixed sleep is a guess');
});

test('finishes fast when the page is fast', async () => {
  const start = Date.now();
  await failureOf(openShop(10));
  const took = Date.now() - start;
  if (took > 200) throw new Error(`It took ${took} ms on a page that was ready in 10. Drop the sleep.`);
});

test('still fails when the basket never updates', async () => {
  const broken = { clickAdd: () => {}, basketText: () => 'Basket: 0 items' };
  if ((await failureOf(broken)) === null) throw new Error('It passed on a broken basket.');
});
