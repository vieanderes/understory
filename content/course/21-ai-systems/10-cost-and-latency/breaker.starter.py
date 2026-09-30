class CircuitBreaker:
    def __init__(self, threshold, cooldown):
        self.threshold = threshold
        self.cooldown = cooldown

    def allow(self, now):
        return True

    def record(self, ok, now):
        pass
