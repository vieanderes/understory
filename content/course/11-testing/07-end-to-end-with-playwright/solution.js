// A pretend shop page. The basket updates a moment after the click, like a real server.
export function openShop(delayMs) {
  let text = 'Basket: 0 items';
  return {
    clickAdd: () => setTimeout(() => (text = 'Basket: 1 item'), delayMs),
    basketText: () => text,
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Like Playwright's expect: tries the check every 20 ms until it passes or 500 ms are up.
export async function eventually(check) {
  const start = Date.now();
  while (true) {
    try {
      return check();
    } catch (error) {
      if (Date.now() - start > 500) throw error;
      await sleep(20);
    }
  }
}

export async function testAddingToBasket(page) {
  page.clickAdd();
  await eventually(() => expect(page.basketText()).toBe('Basket: 1 item'));
}
