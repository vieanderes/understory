// Works, but nobody can read it. Rename everything so it reads like a sentence:
// the function becomes inactiveUserNames(users, today).
function chk(u, d) {
  const x = [];
  for (const i of u) {
    if (d - i.lastLoginDay > 30) x.push(i.name);
  }
  return x;
}
