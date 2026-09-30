# Count each city's roads once. A road's pair then has rank roads[a] + roads[b] - 1,
# since the road between them touches both and is counted twice.
def network_rank(from_, to, cities):
    roads = [0] * (cities + 1)
    for a, b in zip(from_, to):
        roads[a] += 1
        roads[b] += 1
    return max((roads[a] + roads[b] - 1 for a, b in zip(from_, to)), default=0)
