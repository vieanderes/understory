// users.js
export function makeUser(record) {
  return {
    displayName() {
      return record.name;
    },
    // Only this module knows how addresses are stored, so only it changes when that does.
    deliveryPostcode() {
      const chosen = record.addresses.find((a) => a.isDefault) ?? record.addresses[0];
      return chosen.postcode;
    },
  };
}

// shipping.js
export function labelFor(user) {
  return `${user.displayName()}, ${user.deliveryPostcode()}`;
}
