# The stack holds days still waiting for a warmer one, and their temperatures only fall
# from bottom to top. A warmer day answers every cooler day on top before it waits
# itself. Each day is pushed once and popped at most once, so the pass is O(n).
def days_to_wait(temps):
    wait = [0] * len(temps)
    waiting = []
    for day, temp in enumerate(temps):
        while waiting and temps[waiting[-1]] < temp:
            earlier = waiting.pop()
            wait[earlier] = day - earlier
        waiting.append(day)
    return wait
