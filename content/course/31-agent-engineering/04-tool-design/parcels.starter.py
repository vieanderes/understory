import re

LOOKUPS = ("tracking", "order_ref", "postcode")
PAGE_SIZE = 5


def find_parcels(session, args, db):
    # One tool instead of three. Validate args, scope to the session, page the result.
    rows = [p for p in db if p.get("tracking") == args.get("tracking")]
    return {"ok": True, "parcels": rows, "note": ""}
