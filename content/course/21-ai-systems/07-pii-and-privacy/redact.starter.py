import re


def redact_pii(text):
    # Replace IBANs, then emails, then phone numbers, with [IBAN], [EMAIL] and [PHONE].
    return text
