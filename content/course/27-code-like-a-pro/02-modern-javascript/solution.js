function subscriberEmails(users) {
  const emails = users
    .filter((user) => user.subscribed && user.email)
    .map((user) => user.email.toLowerCase());
  return [...new Set(emails)];
}
