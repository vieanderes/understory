from solution import top_k_frequent


@test("example: the k most used words, most used first")
def _():
    words = ["tea", "milk", "tea", "bread", "milk", "tea"]
    expect(top_k_frequent(words, 2)).to_equal(["tea", "milk"])


@test("a tie is broken alphabetically")
def _():
    words = ["pear", "apple", "fig", "apple", "pear", "fig"]
    expect(top_k_frequent(words, 2)).to_equal(["apple", "fig"])


@test("k larger than the number of words returns them all")
def _():
    expect(top_k_frequent(["b", "a", "b"], 10)).to_equal(["b", "a"])


@test("an empty list gives an empty result")
def _():
    expect(top_k_frequent([], 3)).to_equal([])


@test("k of 0 gives an empty result")
def _():
    expect(top_k_frequent(["a", "b"], 0)).to_equal([])


@test("it handles many distinct words")
def _():
    words = [f"w{i % 1000}" for i in range(5000)]
    words += ["w999", "w999", "w5"]
    expect(top_k_frequent(words, 3)).to_equal(["w999", "w5", "w0"])


@test("performance: 200,000 searches of 50,000 words")
def _():
    words = [f"w{(i * 7) % 50_000}" for i in range(200_000)]
    words += ["w42"] * 5
    words += ["w7", "w7"]
    expect(top_k_frequent(words, 3)).to_equal(["w42", "w7", "w0"])
