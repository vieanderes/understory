import numpy as np

from solution import pass_rate


@test("three of four scores pass at 0.7")
def _():
    scores = np.array([0.8, 0.4, 0.9, 0.7])
    expect(pass_rate(scores, 0.7)).to_be_close_to(0.75)


@test("a score equal to the threshold passes")
def _():
    expect(pass_rate(np.array([0.5, 0.5]), 0.5)).to_be_close_to(1.0)


@test("works on a million scores without a loop")
def _():
    scores = np.linspace(0, 1, 1_000_001)
    expect(pass_rate(scores, 0.9)).to_be_close_to(0.1, 3)


@test("returns a plain float")
def _():
    expect(pass_rate(np.array([1.0, 0.0]), 0.5)).to_be_instance_of(float)
