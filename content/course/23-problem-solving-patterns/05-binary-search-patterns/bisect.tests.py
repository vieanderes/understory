from solution import first_bad


def builds(first):
    calls = []

    def is_bad(build):
        calls.append(build)
        return build >= first

    return is_bad, calls


@test("example from the task")
def _():
    is_bad, _calls = builds(6)
    expect(first_bad(8, is_bad)).to_be(6)


@test("one build, and it's bad")
def _():
    is_bad, _calls = builds(1)
    expect(first_bad(1, is_bad)).to_be(1)


@test("the very first build is bad")
def _():
    is_bad, _calls = builds(1)
    expect(first_bad(100, is_bad)).to_be(1)


@test("only the last build is bad")
def _():
    is_bad, _calls = builds(100)
    expect(first_bad(100, is_bad)).to_be(100)


@test("performance: a billion builds in at most 31 checks")
def _():
    is_bad, calls = builds(123_456_789)
    expect(first_bad(1_000_000_000, is_bad)).to_be(123_456_789)
    assert len(calls) <= 31, f"{len(calls)} checks, allowed 31"
