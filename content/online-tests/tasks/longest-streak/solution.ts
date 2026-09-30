function solution(A: number[]): number {
    let best = 0;
    let current = 0;
    for (let i = 0; i < A.length; i++) {
        if (A[i] === 1) {
            current += 1;
        } else {
            best = Math.max(best, current);
            current = 0;
        }
    }
    return Math.max(best, current);
}
