# == compares lists and dicts by value, so two sorted copies of a list count as equal.
# (In JavaScript they are different objects, which is why that version needs JSON.)
def stress_test(fast, slow, generate, runs):
    for _ in range(runs):
        sample = generate()
        if fast(sample) != slow(sample):
            return sample
    return None
