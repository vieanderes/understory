class CircuitBreaker:
    def __init__(self, threshold, cooldown):
        self.threshold = threshold
        self.cooldown = cooldown
        self.failures = 0
        self.opened_at = None   # None means closed: calls go through

    def allow(self, now):
        if self.opened_at is None:
            return True
        # After the cool-down, let a trial call through to test the dependency.
        return now - self.opened_at >= self.cooldown

    def record(self, ok, now):
        if ok:
            self.failures = 0
            self.opened_at = None
            return
        self.failures += 1
        if self.opened_at is not None or self.failures >= self.threshold:
            self.opened_at = now
