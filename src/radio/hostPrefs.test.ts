import { describe, it, expect, beforeEach } from 'vitest';
import { loadHostPrefs, saveHostPrefs, DEFAULT_HOST_PREFS } from './hostPrefs';

describe('hostPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('returns built-in defaults when nothing is stored', () => {
    expect(loadHostPrefs()).toEqual(DEFAULT_HOST_PREFS);
    expect(DEFAULT_HOST_PREFS).toEqual({ bufferSec: 2.0, crossfadeSec: 12 });
  });

  it('round-trips saved values', () => {
    saveHostPrefs({ bufferSec: 3.5, crossfadeSec: 20 });
    expect(loadHostPrefs()).toEqual({ bufferSec: 3.5, crossfadeSec: 20 });
  });

  it('clamps out-of-range saved values on load', () => {
    saveHostPrefs({ bufferSec: 99, crossfadeSec: 99 });
    const prefs = loadHostPrefs();
    expect(prefs.bufferSec).toBe(5);
    expect(prefs.crossfadeSec).toBe(30);
  });

  it('falls back to defaults on corrupt storage', () => {
    localStorage.setItem('radio_host_prefs', '{not json');
    expect(loadHostPrefs()).toEqual(DEFAULT_HOST_PREFS);
  });
});
