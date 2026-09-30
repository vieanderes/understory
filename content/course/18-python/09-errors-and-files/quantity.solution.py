def total_quantity(lines):
    total = 0
    for line in lines:
        try:
            quantity = int(line)
        except ValueError:
            quantity = 0
        if quantity < 0:
            raise ValueError(f"negative quantity: {line}")
        total = total + quantity
    return total
