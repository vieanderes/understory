def solution(K, A):
    # Closing a team the moment it reaches K never hurts: any later cut leaves less behind.
    teams = 0
    energy = 0
    for x in A:
        energy += x
        if energy >= K:
            teams += 1
            energy = 0
    return teams
