// Keep coverage separate from elapsed listening: seeking and replaying an intro cannot complete a song.
export function mergeRanges(ranges) {
    const merged = [];
    for (const [start,end] of ranges.filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a,b) => a[0]-b[0])) {
        const last = merged[merged.length-1];
        if (last && start <= last[1]+0.05) last[1] = Math.max(last[1],end);
        else merged.push([start,end]);
    }
    return merged;
}
export function heardSeconds(ranges) { return mergeRanges(ranges).reduce((sum,[a,b]) => sum+b-a,0); }
export function listenDelta(previousTime, currentTime, elapsed, rate) {
    const delta = currentTime-previousTime;
    return delta >= 0 && delta <= elapsed*Math.min(Math.max(rate,0.25),4)+0.75 ? Math.min(delta,elapsed*rate) : 0;
}
