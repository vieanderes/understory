import math

from solution import stress_test


# A small seeded generator, so a failing input can be made again from its seed.
def make_random(seed):
    state = seed

    def random():
        nonlocal state
        state = (state * 48271) % 2147483647
        return state / 2147483647

    return random


def counter():
    n = 0

    def next_number():
        nonlocal n
        n += 1
        return n

    return next_number


@test("returns None when the two always agree")
def _():
    def double(n):
        return n * 2

    expect(stress_test(double, double, counter(), 50)).to_be_none()


@test("returns the first input where they disagree")
def _():
    def fast(n):
        return n * 2 if n < 5 else n * 2 + 1

    def slow(n):
        return n * 2

    expect(stress_test(fast, slow, counter(), 50)).to_be(5)


@test("stops generating after the first failure")
def _():
    made = []

    def generate():
        made.append(len(made) + 1)
        return len(made)

    stress_test(lambda n: -1 if n == 3 else n, lambda n: n, generate, 100)
    expect(len(made)).to_be(3)


@test("makes exactly `runs` inputs when nothing fails")
def _():
    made = []

    def generate():
        made.append(len(made) + 1)
        return len(made)

    stress_test(lambda n: n, lambda n: n, generate, 40)
    expect(len(made)).to_be(40)
    expect(stress_test(lambda n: n, lambda n: -n, generate, 0)).to_be_none()


@test("compares lists by value")
def _():
    def by_compare(xs):
        return sorted(xs)

    def by_insertion(xs):
        out = []
        for x in xs:
            i = len(out)
            while i > 0 and out[i - 1] > x:
                i -= 1
            out.insert(i, x)
        return out

    random = make_random(7)

    def generate():
        return [math.floor(random() * 10), math.floor(random() * 10), 3]

    expect(stress_test(by_compare, by_insertion, generate, 200)).to_be_none()


@test("finds the bug in a fast best-run sum")
def _():
    def fast(nums):
        best = 0
        run = 0
        for x in nums:
            run = max(x, run + x)
            best = max(best, run)
        return best

    def slow(nums):
        best = -math.inf
        for i in range(len(nums)):
            total = 0
            for x in nums[i:]:
                total += x
                best = max(best, total)
        return best

    random = make_random(42)

    def generate():
        length = 1 + math.floor(random() * 4)
        return [math.floor(random() * 11) - 5 for _ in range(length)]

    found = stress_test(fast, slow, generate, 500)
    expect(found).not_.to_be_none()
    if found is not None:
        expect(fast(found)).not_.to_be(slow(found))
