import re


def solution(R, C):
    tools = {}
    for entry in R:
        parts = entry.split(' ')
        params = {}
        for param in parts[2:]:
            key, kind = param.split(':')
            params[key] = kind
        tools[parts[0]] = (parts[1] == 'write', params)

    def valid(kind, value):
        if kind == 'int':
            return re.fullmatch(r'-?[0-9]+', value) is not None
        if kind == 'bool':
            return value in ('true', 'false')
        return True

    verdicts = []
    for call in C:
        parts = call.split(' ')
        if parts[0] not in tools:
            verdicts.append('unknown-tool')
            continue
        write, params = tools[parts[0]]
        approved = False
        args = {}
        for token in parts[1:]:
            if token == 'approved':
                approved = True
            else:
                key, value = token.split('=', 1)
                args[key] = value
        # The checks run in the order of the verdict list, so the first that applies wins.
        if any(key not in params for key in args):
            verdicts.append('unknown-arg')
        elif any(key not in args for key in params):
            verdicts.append('missing-arg')
        elif any(not valid(kind, args[key]) for key, kind in params.items()):
            verdicts.append('bad-type')
        elif write and not approved:
            verdicts.append('needs-approval')
        else:
            verdicts.append('ok')
    return verdicts
