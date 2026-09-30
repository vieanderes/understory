def order_line(item, qty, price):
    total = qty * price
    if total >= 50:
        return f"{qty} x {item}: {total:.2f}, free delivery"
    return f"{qty} x {item}: {total:.2f}"
