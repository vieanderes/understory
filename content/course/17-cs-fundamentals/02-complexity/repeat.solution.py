def repeat_customers(yesterday, today):
    # Build the set once, so each check jumps straight to the answer instead of walking a list.
    seen = set(yesterday)
    return [email for email in today if email in seen]
