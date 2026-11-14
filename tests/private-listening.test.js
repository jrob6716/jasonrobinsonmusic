import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRanges,heardSeconds,listenDelta } from '../js/private-listening.js';
test('coverage merges replayed regions without counting skipped sections', () => {
    assert.deepEqual(mergeRanges([[0,20],[10,30],[90,100]]),[[0,30],[90,100]]);
    assert.equal(heardSeconds([[0,20],[0,20],[90,100]]),30);
    assert.equal(heardSeconds([[0,10],[NaN,20],[20,10]]),10);
});
test('listening time excludes seeks, reverse jumps, pauses, and buffering', () => {
    assert.equal(listenDelta(1,1.25,0.25,1),0.25);
    assert.equal(listenDelta(1,90,0.25,1),0);
    assert.equal(listenDelta(90,1,0.25,1),0);
    assert.equal(listenDelta(1,1,15,1),0);
    assert.equal(listenDelta(1,1.5,0.25,2),0.5);
});
