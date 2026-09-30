from math import gcd


def solution(N, K):
    # A waiter with step k serves exactly the multiples of gcd(N, k).
    steps = list({gcd(N, k) for k in K})
    primes = []
    rest = N
    p = 2
    while p * p <= rest:
        if rest % p == 0:
            primes.append(p)
            while rest % p == 0:
                rest //= p
        p += 1
    if rest > 1:
        primes.append(rest)

    def phi(m):
        out = m
        for q in primes:
            if m % q == 0:
                out = out // q * (q - 1)
        return out

    # Seat x has gcd(x, N) = d for exactly phi(N / d) seats, and it is served when some
    # step divides d. Summing over the divisors of N avoids walking all N seats.
    served = 0
    i = 1
    while i * i <= N:
        if N % i == 0:
            for d in {i, N // i}:
                if any(d % g == 0 for g in steps):
                    served += phi(N // d)
        i += 1
    return served
