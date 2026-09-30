from solution import group_anagrams


@test("example: listen, silent and enlist")
def _():
    expect(group_anagrams(["listen", "google", "silent", "enlist"])).to_equal(
        [["listen", "silent", "enlist"], ["google"]]
    )


@test("keeps groups in order of first appearance")
def _():
    expect(group_anagrams(["tab", "eat", "bat", "tea"])).to_equal([["tab", "bat"], ["eat", "tea"]])


@test("an empty list gives no groups")
def _():
    expect(group_anagrams([])).to_equal([])


@test("repeated words land in the same group")
def _():
    expect(group_anagrams(["dog", "dog"])).to_equal([["dog", "dog"]])


@test("words of different lengths never share a group")
def _():
    expect(group_anagrams(["a", "aa"])).to_equal([["a"], ["aa"]])


@test("performance: 100,000 words")
def _():
    words = []
    for i in range(100_000):
        n = i
        word = ""
        for _ in range(6):
            word += chr(97 + n % 26)
            n //= 26
        words.append(word)
    words.append("baaaaa")
    groups = group_anagrams(words)
    expect(groups[0]).to_equal(["aaaaaa"])
    expect(groups[1]).to_equal(["baaaaa", "abaaaa", "aabaaa", "aaabaa", "baaaaa"])
    expect(groups).to_have_length(14_773)
