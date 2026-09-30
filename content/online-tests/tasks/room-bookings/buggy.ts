function solution(B: number[][]): number {
    const byEnd = B.slice().sort((x, y) => x[1] - y[1]);
    let accepted = 0;
    let lastEnd = 0;
    for (let i = 0; i < byEnd.length; i++) {
        if (byEnd[i][0] > lastEnd) {
            accepted += 1;
            lastEnd = byEnd[i][1];
        }
    }
    return accepted;
}
