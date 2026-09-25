import { describe, expect, it } from 'vitest';
import { segmentIntersection, pointInPolygon, polygonArea, distToSegment, type Vec } from './geometry';

describe('segmentIntersection', () => {
  it('finds the crossing point of two crossing segments', () => {
    const p = segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(5);
    expect(p!.y).toBeCloseTo(5);
  });
  it('returns null for parallel, collinear or separate segments', () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toBeNull();
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })).toBeNull();
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 0 }, { x: 6, y: -3 })).toBeNull();
  });
  it('does not count segments that would only meet if extended', () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBeNull();
  });
  it('reports the parameter along the first segment', () => {
    const p = segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 3, y: -1 }, { x: 3, y: 1 });
    expect(p!.t).toBeCloseTo(0.3);
  });
});

describe('pointInPolygon', () => {
  const square: Vec[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  it('tells inside from outside for a square', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: -0.1, y: 5 }, square)).toBe(false);
  });
  it('handles a concave polygon (a U shape)', () => {
    const u: Vec[] = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 20, y: 30 }, { x: 20, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 30 }, { x: 0, y: 30 }];
    expect(pointInPolygon({ x: 5, y: 20 }, u)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 20 }, u)).toBe(false); // in the notch
    expect(pointInPolygon({ x: 25, y: 20 }, u)).toBe(true);
  });
});

describe('polygonArea', () => {
  it('is the absolute area whatever the winding', () => {
    const sq: Vec[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(polygonArea(sq)).toBeCloseTo(100);
    expect(polygonArea([...sq].reverse())).toBeCloseTo(100);
  });
  it('approximates a circle drawn as a polyline', () => {
    const circle = Array.from({ length: 360 }, (_, i) => ({ x: 50 * Math.cos((i * Math.PI) / 180), y: 50 * Math.sin((i * Math.PI) / 180) }));
    expect(polygonArea(circle)).toBeCloseTo(Math.PI * 2500, -1);
  });
});

describe('distToSegment', () => {
  it('measures to the nearest point, including the end points', () => {
    expect(distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
    expect(distToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
    expect(distToSegment({ x: 2, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(Math.SQRT2);
  });
});
