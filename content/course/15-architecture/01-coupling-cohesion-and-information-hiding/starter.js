// users.js
export function makeUser(record) {
  return {
    displayName() {
      return record.name;
    },
    profile: record,
  };
}

// shipping.js
export function labelFor(user) {
  const postcode = user.profile.addresses[0].postcode;
  return `${user.displayName()}, ${postcode}`;
}
