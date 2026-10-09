import { describe, expect, it } from 'vitest';
import { pageToSheet, sheetToSpread } from './spread';

describe('pageToSheet', () => {
  it('cover page maps to sheet 0', () => {
    expect(pageToSheet(0)).toBe(0);
  });
  it('pages pair up as (1,2) (3,4) ... per sheet', () => {
    expect(pageToSheet(1)).toBe(1);
    expect(pageToSheet(2)).toBe(1);
    expect(pageToSheet(3)).toBe(2);
    expect(pageToSheet(14)).toBe(7);
    expect(pageToSheet(15)).toBe(8);
  });
});

describe('sheetToSpread', () => {
  it('cover shows only the right page', () => {
    expect(sheetToSpread(0, 8, 16)).toEqual({ left: null, right: 1 });
  });
  it('middle sheets show both pages (1-based)', () => {
    expect(sheetToSpread(3, 8, 16)).toEqual({ left: 6, right: 7 });
  });
  it('back cover shows only the left page', () => {
    expect(sheetToSpread(8, 8, 16)).toEqual({ left: 16, right: null });
  });
  it('an odd page count leaves the last right page empty', () => {
    expect(sheetToSpread(2, 3, 5)).toEqual({ left: 4, right: 5 });
    expect(sheetToSpread(2, 3, 4)).toEqual({ left: 4, right: null });
  });
});
