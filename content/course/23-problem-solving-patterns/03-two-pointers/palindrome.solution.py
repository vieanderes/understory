def is_palindrome(text):
    left, right = 0, len(text) - 1
    while left < right:
        # Skip spaces and punctuation on either side before comparing.
        if not text[left].isalnum():
            left += 1
        elif not text[right].isalnum():
            right -= 1
        elif text[left].lower() != text[right].lower():
            return False
        else:
            left += 1
            right -= 1
    return True
