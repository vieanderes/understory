import { makeUser, labelFor } from './solution';

const ana = {
  name: 'Ana Silva',
  addresses: [{ street: '4 Mill Lane', postcode: 'LS1 4AB', isDefault: false }],
};

const ben = {
  name: 'Ben Okafor',
  addresses: [
    { street: '9 High Street', postcode: 'M1 2CD', isDefault: false },
    { street: '2 Park Road', postcode: 'BS8 1EF', isDefault: true },
  ],
};

test('one address: the label uses it', () => {
  expect(labelFor(makeUser(ana))).toBe('Ana Silva, LS1 4AB');
});

test('the default address wins, wherever it is in the list', () => {
  expect(labelFor(makeUser(ben))).toBe('Ben Okafor, BS8 1EF');
});

test('the user answers deliveryPostcode()', () => {
  expect(makeUser(ben).deliveryPostcode()).toBe('BS8 1EF');
});

test('the user no longer hands out profile', () => {
  expect(makeUser(ana).profile).toBeUndefined();
});

test('labelFor needs only the two public methods', () => {
  // A user from a future users module, with its data stored some other way.
  const futureUser = { displayName: () => 'Cy Moreau', deliveryPostcode: () => 'EH1 1YZ' };
  expect(labelFor(futureUser)).toBe('Cy Moreau, EH1 1YZ');
});
