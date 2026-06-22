import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); });
import { LocalDeck } from './localDeck';

function mockFile(name: string): File {
  return new File([''], name, { type: 'audio/mpeg' });
}

function makeFiles(...names: string[]): File[] {
  return names.map(mockFile);
}

describe('LocalDeck', () => {
  it('starts empty', () => {
    const deck = new LocalDeck();
    expect(deck.isEmpty).toBe(true);
    expect(deck.length).toBe(0);
    expect(deck.current).toBeNull();
    expect(deck.next).toBeNull();
  });

  it('add() calls createUrl for each file', () => {
    const createUrl = vi.fn().mockImplementation((f: File) => `blob:${f.name}`);
    const deck = new LocalDeck(createUrl);
    deck.add(makeFiles('a.mp3', 'b.mp3'));
    expect(createUrl).toHaveBeenCalledTimes(2);
    expect(deck.length).toBe(2);
  });

  it('normalises track name — strips extension and replaces dashes/underscores', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('my-cool_track.mp3'));
    expect(deck.current?.name).toBe('my cool track');
  });

  it('advance() moves to next track', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3', 'b.mp3', 'c.mp3'));
    expect(deck.current?.name).toBe('a');
    expect(deck.advance()).toBe(true);
    expect(deck.current?.name).toBe('b');
    expect(deck.advance()).toBe(true);
    expect(deck.current?.name).toBe('c');
  });

  it('advance() returns false at the end', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3'));
    expect(deck.advance()).toBe(false);
    expect(deck.current?.name).toBe('a');
  });

  it('previous() moves back', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3', 'b.mp3'));
    deck.advance();
    expect(deck.previous()).toBe(true);
    expect(deck.current?.name).toBe('a');
  });

  it('previous() returns false at start', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3'));
    expect(deck.previous()).toBe(false);
  });

  it('jumpTo() moves to the given id', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3', 'b.mp3', 'c.mp3'));
    const id = deck.state.queue[2].id;
    expect(deck.jumpTo(id)).toBe(true);
    expect(deck.current?.name).toBe('c');
  });

  it('jumpTo() returns false for unknown id', () => {
    const deck = new LocalDeck(() => 'blob:x');
    expect(deck.jumpTo('ghost')).toBe(false);
  });

  it('next getter returns the track after current', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3', 'b.mp3'));
    expect(deck.next?.name).toBe('b');
    deck.advance();
    expect(deck.next).toBeNull();
  });

  it('remove() calls URL.revokeObjectURL with the track url', () => {
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const deck = new LocalDeck((f) => `blob:${f.name}`);
    deck.add(makeFiles('x.mp3'));
    const id = deck.state.queue[0].id;
    deck.remove(id);
    expect(revokeUrl).toHaveBeenCalledWith('blob:x.mp3');
    expect(deck.isEmpty).toBe(true);
  });

  it('remove() adjusts currentIndex when removing before current', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3', 'b.mp3', 'c.mp3'));
    deck.advance();
    deck.advance();
    expect(deck.current?.name).toBe('c');
    const firstId = deck.state.queue[0].id;
    deck.remove(firstId);
    expect(deck.current?.name).toBe('c');
  });

  it('remove() clamps to last track when removing last-position item', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3', 'b.mp3'));
    deck.advance();
    expect(deck.current?.name).toBe('b');
    const secondId = deck.state.queue[1].id;
    deck.remove(secondId);
    expect(deck.current?.name).toBe('a');
  });

  it('remove() is a no-op for unknown id', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3'));
    expect(() => deck.remove('ghost')).not.toThrow();
    expect(deck.length).toBe(1);
  });

  it('clear() revokes all URLs and empties the queue', () => {
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const deck = new LocalDeck((f) => `blob:${f.name}`);
    deck.add(makeFiles('a.mp3', 'b.mp3', 'c.mp3'));
    deck.clear();
    expect(revokeUrl).toHaveBeenCalledTimes(3);
    expect(deck.isEmpty).toBe(true);
    expect(deck.current).toBeNull();
  });

  it('state snapshot is immutable (modifying it does not change the deck)', () => {
    const deck = new LocalDeck(() => 'blob:x');
    deck.add(makeFiles('a.mp3'));
    const snap = deck.state;
    (snap.queue as DeckTrack[]).push({ id: '99', file: mockFile('z.mp3'), url: 'blob:z', name: 'z' });
    expect(deck.length).toBe(1);
  });
});

import type { DeckTrack } from './localDeck';
