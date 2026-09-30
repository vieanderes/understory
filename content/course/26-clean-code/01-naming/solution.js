function inactiveUserNames(users, today) {
  const names = [];
  for (const user of users) {
    const daysAway = today - user.lastLoginDay;
    if (daysAway > 30) names.push(user.name);
  }
  return names;
}
