def gate(contract, checks, changed):
    problems = []
    for name in contract["required"]:
        code = checks.get(name)
        if code is None:
            problems.append(f"not run: {name}")
        elif code != 0:
            problems.append(f"failed: {name}")
    for path in changed:
        if any(path.startswith(prefix) for prefix in contract["forbidden"]):
            problems.append(f"forbidden: {path}")
        elif not any(path.startswith(prefix) for prefix in contract["allowed"]):
            problems.append(f"out of scope: {path}")
    return problems
