import { checkIntentMap, type Intent } from './solution';

const tools = ['care_guide', 'search_stock', 'lookup_order', 'hand_to_person'];

const good: Intent[] = [
  { name: 'care_advice', examples: ['why is my basil yellow?', 'how often to water ferns'], route: 'care_guide' },
  { name: 'check_stock', examples: ['any lavender in stock?', 'do you sell olive trees'], route: 'search_stock' },
  { name: 'fallback', examples: [], route: 'hand_to_person' },
];

test('a complete map has no problems', () => {
  expect(checkIntentMap(good, tools)).toEqual([]);
});

test('a missing route and an unknown tool are named, in intent order', () => {
  const map: Intent[] = [
    { name: 'order_status', examples: ["where's order 4411?", 'has my order shipped'], route: '' },
    { name: 'gift_cards', examples: ['buy a gift card', 'gift card balance'], route: 'gift_shop' },
    ...good,
  ];
  expect(checkIntentMap(map, tools)).toEqual(['order_status: no route', 'gift_cards: unknown tool gift_shop']);
});

test('an intent needs two examples, but the fallback needs none', () => {
  const map: Intent[] = [{ name: 'repotting', examples: ['when to repot a cactus'], route: 'care_guide' }, ...good];
  expect(checkIntentMap(map, tools)).toEqual(['repotting: needs 2 examples']);
});

test('an example in two intents is reported on the later one, ignoring case and outer spaces', () => {
  const map: Intent[] = [
    ...good.slice(0, 2),
    { name: 'plant_health', examples: [' Why is my basil yellow? ', 'brown spots on leaves'], route: 'care_guide' },
    good[2]!,
  ];
  expect(checkIntentMap(map, tools)).toEqual(['plant_health: " Why is my basil yellow? " is also in care_advice']);
});

test('a map without a fallback says so last', () => {
  const map: Intent[] = [{ name: 'care_advice', examples: ['why is my basil yellow?'], route: 'care_guide' }];
  expect(checkIntentMap(map, tools)).toEqual(['care_advice: needs 2 examples', 'no fallback']);
});
