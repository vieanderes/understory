import math

from solution import SampleOptions, sample, softmax

# Logits whose softmax is exactly these probabilities, so the tests are easy to read.
FOUR = [math.log(0.5), math.log(0.3), math.log(0.15), math.log(0.05)]
ALL = SampleOptions(temperature=1, top_k=math.inf, top_p=1)


def fixed(value):
    """A stand-in for random.random that always gives the same number."""
    return lambda: value


@test("softmax gives probabilities that add up to 1")
def _():
    probs = softmax([2, 1, 0])
    expect(sum(probs)).to_be_close_to(1, 10)
    assert probs[0] > probs[1]


@test("softmax survives huge scores")
def _():
    assert softmax([1000, 1000]) == [0.5, 0.5]


@test("temperature 0 always picks the highest score")
def _():
    assert sample([0.2, 3, 1], SampleOptions(temperature=0), fixed(0.99)) == 1


@test("the draw follows the probabilities, and returns the token id")
def _():
    assert sample(FOUR, ALL, fixed(0.1)) == 0
    assert sample(FOUR, ALL, fixed(0.7)) == 1
    assert sample(FOUR, ALL, fixed(0.99)) == 3


@test("top-k keeps only the k likeliest tokens")
def _():
    assert sample(FOUR, SampleOptions(top_k=2), fixed(0.99)) == 1
    assert sample(FOUR, SampleOptions(top_k=1), fixed(0.99)) == 0


@test("top-p keeps the fewest tokens that reach p, including the one that crosses it")
def _():
    assert sample(FOUR, SampleOptions(top_p=0.75), fixed(0.99)) == 1
    assert sample(FOUR, SampleOptions(top_p=0.45), fixed(0.99)) == 0


@test("a high temperature gives the long shot more chances")
def _():
    assert sample([2, 0], ALL, fixed(0.8)) == 0
    assert sample([2, 0], SampleOptions(temperature=10), fixed(0.8)) == 1
