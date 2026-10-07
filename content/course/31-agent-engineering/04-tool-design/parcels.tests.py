from solution import find_parcels

ME = {"customer": "c-1"}


def parcel(n, customer="c-1", postcode="LS6 2AB"):
    return {"tracking": f"PT{n:08d}", "order_ref": f"ORD-{n}", "postcode": postcode,
            "customer": customer, "status": "in transit"}


DB = [parcel(n) for n in range(1, 8)] + [parcel(90, customer="c-2"), parcel(91, customer="c-2")]


@test("finds a parcel by tracking number")
def _():
    got = find_parcels(ME, {"tracking": "PT00000003"}, DB)
    assert got == {"ok": True, "parcels": [{"tracking": "PT00000003", "status": "in transit"}],
                   "note": "showing 1 of 1"}


@test("never returns another customer's parcels")
def _():
    got = find_parcels(ME, {"tracking": "PT00000090"}, DB)
    assert got["parcels"] == [], "parcel 90 belongs to customer c-2"
    got = find_parcels(ME, {"postcode": "ls62ab", "page": 2}, DB)
    assert all(p["tracking"] != "PT00000091" for p in got["parcels"])


@test("rejects a customer argument and lists the allowed fields")
def _():
    got = find_parcels(ME, {"postcode": "LS6 2AB", "customer": "c-2"}, DB)
    assert got["ok"] is False
    expect(got["error"]).to_contain("Unknown field 'customer'")
    expect(got["error"]).to_contain("tracking, order_ref, postcode, page")


@test("asks for exactly one way to look a parcel up")
def _():
    expect(find_parcels(ME, {}, DB)["error"]).to_contain("Give one of")
    two = find_parcels(ME, {"tracking": "PT00000001", "order_ref": "ORD-1"}, DB)
    expect(two["error"]).to_contain("Give only one of")


@test("a malformed tracking number gets an example of the right shape")
def _():
    got = find_parcels(ME, {"tracking": "12345678"}, DB)
    assert got["ok"] is False
    expect(got["error"]).to_contain("PT12345678")


@test("big results are paged, and the note says so")
def _():
    first = find_parcels(ME, {"postcode": "LS6 2AB"}, DB)
    assert len(first["parcels"]) == 5
    assert first["note"] == "showing 5 of 7; pass page=2 for more"
    second = find_parcels(ME, {"postcode": "LS6 2AB", "page": 2}, DB)
    assert second["note"] == "showing 2 of 7"
