PAIRS = {")": "(", "]": "[", "}": "{"}


def is_balanced(text):
    stack = []
    for char in text:
        if char in "([{":
            stack.append(char)
        elif char in PAIRS:
            # An empty stack means a closer with nothing to close.
            if not stack or stack.pop() != PAIRS[char]:
                return False
    return not stack
