from solution import rank_open


def bet(claim, impact, uncertainty, irreversible=False, tested=False):
    return {
        "claim": claim,
        "impact": impact,
        "uncertainty": uncertainty,
        "irreversible": irreversible,
        "tested": tested,
    }


@test("the riskiest open assumption comes first")
def _():
    bets = [bet("Users want summaries", 3, 2), bet("Summaries are accurate on real tickets", 5, 4)]
    assert rank_open(bets) == ["Summaries are accurate on real tickets", "Users want summaries"]


@test("a tested assumption is left out")
def _():
    bets = [bet("Tickets are in English", 4, 5, tested=True), bet("Agents read the summary", 3, 3)]
    assert rank_open(bets) == ["Agents read the summary"]


@test("on a tie, the irreversible one goes first")
def _():
    bets = [bet("Latency under 2 s is enough", 3, 4), bet("We can store ticket text", 4, 3, irreversible=True)]
    assert rank_open(bets) == ["We can store ticket text", "Latency under 2 s is enough"]


@test("otherwise equal assumptions keep their order")
def _():
    bets = [bet("First", 2, 2), bet("Second", 4, 1), bet("Third", 1, 4)]
    assert rank_open(bets) == ["First", "Second", "Third"]


@test("nothing open gives an empty list")
def _():
    assert rank_open([bet("Done", 5, 5, tested=True)]) == []
