function solution(A: number[], X: number): number {
    let lo = 0;
    let hi = A.length - 1;
    let answer = -1;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (A[mid] >= X) {
            answer = mid;
            hi = mid - 1;
        } else {
            lo = mid + 1;
        }
    }
    return answer;
}
