function solution(L: string[]): string[] {
  // Emails go first, so the digits inside an address are never read as a phone or a card.
  const EMAIL = /[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+/g;
  // One digit, then digits each after at most one space or hyphen: a longest run.
  const NUMBER = /(\+?)([0-9](?:[ -]?[0-9])*)/g;
  return L.map((line) => {
    const pass1 = line.replace(EMAIL, (match) => {
      const at = match.indexOf('@');
      const raw = match.slice(at + 1);
      const domain = raw.replace(/\.+$/, '');
      const trailing = raw.slice(domain.length);
      if (domain.includes('.') && !domain.startsWith('.')) return '[EMAIL]' + trailing;
      return match;
    });
    return pass1.replace(NUMBER, (match, plus: string, digits: string) => {
      const count = digits.replace(/[ -]/g, '').length;
      if (plus === '+') return count >= 8 && count <= 15 ? '[PHONE]' : match;
      return count === 16 ? '[CARD]' : match;
    });
  });
}
