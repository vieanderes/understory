import re

# Emails go first, so the digits inside an address are never read as a phone or a card.
EMAIL = re.compile(r'[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+')
# One digit, then digits each after at most one space or hyphen: a longest run.
NUMBER = re.compile(r'(\+?)([0-9](?:[ -]?[0-9])*)')


def redact_email(match):
    text = match.group(0)
    raw = text[text.index('@') + 1:]
    domain = raw.rstrip('.')
    trailing = raw[len(domain):]
    if '.' in domain and not domain.startswith('.'):
        return '[EMAIL]' + trailing
    return text


def redact_number(match):
    plus, digits = match.group(1), match.group(2)
    count = len(digits.replace(' ', '').replace('-', ''))
    if plus == '+':
        return '[PHONE]' if 8 <= count <= 15 else match.group(0)
    return '[CARD]' if count == 16 else match.group(0)


def solution(L):
    return [NUMBER.sub(redact_number, EMAIL.sub(redact_email, line)) for line in L]
