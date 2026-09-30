from solution import leaderboard


@test("the example from the statement")
def _():
    results = [
        {"name": "ada", "points": 30},
        {"name": "bo", "points": 50},
        {"name": "ada", "points": 40},
    ]
    expect(leaderboard(results, 2)).to_equal(["ada(70)", "bo(50)"])


@test("a name that appears several times is summed")
def _():
    results = [
        {"name": "kim", "points": 10},
        {"name": "kim", "points": 10},
        {"name": "lee", "points": 15},
    ]
    expect(leaderboard(results, 1)).to_equal(["kim(20)"])


@test("the format is name(total), with no spaces")
def _():
    expect(leaderboard([{"name": "sam", "points": 7}], 1)).to_equal(["sam(7)"])


@test("a tie goes to the name that comes first")
def _():
    results = [
        {"name": "mo", "points": 20},
        {"name": "jo", "points": 20},
    ]
    expect(leaderboard(results, 2)).to_equal(["jo(20)", "mo(20)"])


@test("ties use string order, so capitals come first")
def _():
    results = [
        {"name": "amy", "points": 5},
        {"name": "Zoe", "points": 5},
    ]
    expect(leaderboard(results, 2)).to_equal(["Zoe(5)", "amy(5)"])


@test("a total of zero still counts")
def _():
    expect(leaderboard([{"name": "pat", "points": 0}], 3)).to_equal(["pat(0)"])


@test("n larger than the number of players returns them all")
def _():
    results = [
        {"name": "ivy", "points": 3},
        {"name": "eli", "points": 9},
    ]
    expect(leaderboard(results, 10)).to_equal(["eli(9)", "ivy(3)"])


@test("n of zero returns an empty list")
def _():
    expect(leaderboard([{"name": "ivy", "points": 3}], 0)).to_equal([])


@test("no results returns an empty list")
def _():
    expect(leaderboard([], 5)).to_equal([])


@test("large: 100,000 results for 1,000 players")
def _():
    results = [{"name": f"p{i % 1000}", "points": i % 7} for i in range(100_000)]
    expect(leaderboard(results, 3)).to_equal(["p104(305)", "p111(305)", "p118(305)"])
