import re

LOOKUPS = ("tracking", "order_ref", "postcode")
PAGE_SIZE = 5


def fail(message):
    return {"ok": False, "error": message}


def squash(postcode):
    return postcode.replace(" ", "").upper()


def find_parcels(session, args, db):
    for key in args:
        if key not in LOOKUPS and key != "page":
            return fail(f"Unknown field '{key}'. Allowed: tracking, order_ref, postcode, page.")
    given = [key for key in LOOKUPS if key in args]
    if not given:
        return fail("Give one of: tracking, order_ref, postcode.")
    if len(given) > 1:
        return fail("Give only one of: tracking, order_ref, postcode.")
    key, value = given[0], str(args[given[0]]).strip()
    if key == "tracking" and not re.fullmatch(r"PT\d{8}", value):
        return fail(f"Tracking '{value}' isn't valid. It looks like PT12345678.")
    page = args.get("page", 1)
    if not isinstance(page, int) or page < 1:
        return fail("page must be a whole number from 1.")

    mine = [p for p in db if p["customer"] == session["customer"]]  # never from args
    if key == "postcode":
        rows = [p for p in mine if squash(p["postcode"]) == squash(value)]
    else:
        rows = [p for p in mine if p[key] == value]

    start = (page - 1) * PAGE_SIZE
    shown = rows[start:start + PAGE_SIZE]
    note = f"showing {len(shown)} of {len(rows)}"
    if start + PAGE_SIZE < len(rows):
        note += f"; pass page={page + 1} for more"
    parcels = [{"tracking": p["tracking"], "status": p["status"]} for p in shown]
    return {"ok": True, "parcels": parcels, "note": note}
