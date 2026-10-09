import { describe, it, expect } from 'vitest';
import { arbitrate, nextClickCount, PointerContext } from './gesture';

const base: PointerContext = {
  enabled: true, button: 0, side: 'right', canvasX: 600, canvasWidth: 1440, onText: true, onAnnotation: false,
};

describe('arbitrate', () => {
  it('claims presses on text for the reader', () => {
    expect(arbitrate(base)).toBe('reader');
  });
  it('leaves blank space to the engine so it can flip', () => {
    expect(arbitrate({ ...base, onText: false })).toBe('engine');
  });
  it('claims presses on an annotation even without text hit', () => {
    expect(arbitrate({ ...base, onText: false, onAnnotation: true })).toBe('reader');
  });
  it('keeps the outer flip edge for the engine', () => {
    expect(arbitrate({ ...base, canvasX: 1430 })).toBe('engine');
    expect(arbitrate({ ...base, side: 'left', canvasX: 20 })).toBe('engine');
    expect(arbitrate({ ...base, side: 'left', canvasX: 1430 })).toBe('reader');
  });
  it('does nothing when disabled and always handles right click', () => {
    expect(arbitrate({ ...base, enabled: false })).toBe('engine');
    expect(arbitrate({ ...base, button: 2, onText: false })).toBe('reader');
  });
});

describe('nextClickCount', () => {
  it('accumulates quick clicks at the same spot up to triple', () => {
    let c = nextClickCount(null, { time: 0, x: 0, y: 0 });
    expect(c).toBe(1);
    c = nextClickCount({ time: 0, x: 0, y: 0, count: c }, { time: 200, x: 2, y: 1 });
    expect(c).toBe(2);
    c = nextClickCount({ time: 200, x: 2, y: 1, count: c }, { time: 400, x: 2, y: 1 });
    expect(c).toBe(3);
    c = nextClickCount({ time: 400, x: 2, y: 1, count: c }, { time: 600, x: 2, y: 1 });
    expect(c).toBe(3);
  });
  it('resets when slow or far', () => {
    expect(nextClickCount({ time: 0, x: 0, y: 0, count: 2 }, { time: 900, x: 0, y: 0 })).toBe(1);
    expect(nextClickCount({ time: 0, x: 0, y: 0, count: 2 }, { time: 100, x: 40, y: 0 })).toBe(1);
  });
});
