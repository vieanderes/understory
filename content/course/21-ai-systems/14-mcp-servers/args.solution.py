TYPES = {"string": str, "integer": int, "boolean": bool}


def has_type(value, type_name):
    # bool is a subclass of int in Python, so True must not pass as an integer.
    if type_name == "integer" and isinstance(value, bool):
        return False
    return isinstance(value, TYPES[type_name])


def validate_args(schema, args):
    errors = [f"missing: {key}" for key in schema["required"] if key not in args]
    for key, value in args.items():
        spec = schema["properties"].get(key)
        if spec is None:
            errors.append(f"unknown: {key}")
        elif not has_type(value, spec["type"]):
            errors.append(f"type: {key}")
        elif "enum" in spec and value not in spec["enum"]:
            errors.append(f"enum: {key}")
    return errors
