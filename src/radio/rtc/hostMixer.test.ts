import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HostMixer } from './hostMixer';

// ---- Minimal Web Audio stubs ----

function makeNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeGainNode(value = 1) {
  return {
    ...makeNode(),
    gain: { value },
  };
}

function makeAnalyserNode() {
  return {
    ...makeNode(),
    fftSize: 2048,
    frequencyBinCount: 1024,
    getFloatFrequencyData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
  };
}

function makeMediaStreamDestination() {
  const node = makeNode();
  const stream = { getTracks: () => [] } as unknown as MediaStream;
  return { ...node, stream };
}

function makeMediaStreamSource() {
  return makeNode();
}

function makeMediaElementSource() {
  return makeNode();
}

function makeAudioContextMock() {
  const gainNode = makeGainNode();
  const analyserNode = makeAnalyserNode();
  const destinationNode = makeMediaStreamDestination();
  const streamSourceNode = makeMediaStreamSource();
  const elementSourceNode = makeMediaElementSource();

  const ctx = {
    state: 'running' as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn().mockReturnValue(gainNode),
    createAnalyser: vi.fn().mockReturnValue(analyserNode),
    createMediaStreamDestination: vi.fn().mockReturnValue(destinationNode),
    createMediaStreamSource: vi.fn().mockReturnValue(streamSourceNode),
    createMediaElementSource: vi.fn().mockReturnValue(elementSourceNode),
    _gainNode: gainNode,
    _analyserNode: analyserNode,
    _destinationNode: destinationNode,
    _streamSourceNode: streamSourceNode,
    _elementSourceNode: elementSourceNode,
  };
  return ctx;
}

type CtxMock = ReturnType<typeof makeAudioContextMock>;

// ---- Tests ----

describe('HostMixer', () => {
  let ctxMock: CtxMock;
  let mixer: HostMixer;

  beforeEach(() => {
    ctxMock = makeAudioContextMock();
    mixer = new HostMixer(() => ctxMock as unknown as AudioContext);
  });

  // --- graph construction ---

  it('start() builds master → analyser → destination node chain', async () => {
    await mixer.start();

    expect(ctxMock.createGain).toHaveBeenCalled();
    expect(ctxMock.createAnalyser).toHaveBeenCalled();
    expect(ctxMock.createMediaStreamDestination).toHaveBeenCalled();

    // master → analyser → destination
    expect(ctxMock._gainNode.connect).toHaveBeenCalledWith(ctxMock._analyserNode);
    expect(ctxMock._analyserNode.connect).toHaveBeenCalledWith(ctxMock._destinationNode);
  });

  it('start() returns the destination stream', async () => {
    const stream = await mixer.start();
    expect(stream).toBe(ctxMock._destinationNode.stream);
  });

  it('start() resumes a suspended context', async () => {
    ctxMock.state = 'suspended';
    await mixer.start();
    expect(ctxMock.resume).toHaveBeenCalled();
  });

  // --- addFileElement ---

  it('addFileElement() creates a MediaElementSource and routes through a gain node', async () => {
    await mixer.start();
    const audioEl = {} as HTMLAudioElement;
    const id = mixer.addFileElement(audioEl);

    expect(ctxMock.createMediaElementSource).toHaveBeenCalledWith(audioEl);
    // element source node should connect to a (new) gain node
    expect(ctxMock._elementSourceNode.connect).toHaveBeenCalled();
    expect(id).toBeTruthy();
  });

  it('addFileElement() registers the source in entries', async () => {
    await mixer.start();
    const id = mixer.addFileElement({} as HTMLAudioElement);
    expect(mixer.entries).toContainEqual(expect.objectContaining({ id, kind: 'file', gain: 1 }));
  });

  it('addFileElement() throws before start() is called', () => {
    expect(() => mixer.addFileElement({} as HTMLAudioElement)).toThrow('start()');
  });

  // --- setGain ---

  it('setGain() updates the gain node value', async () => {
    await mixer.start();
    const id = mixer.addFileElement({} as HTMLAudioElement);

    // createGain is called for master + one per source; find the source gain
    const calls = ctxMock.createGain.mock.results;
    const sourceGainNode = calls[calls.length - 1].value as ReturnType<typeof makeGainNode>;

    mixer.setGain(id, 0.5);
    expect(sourceGainNode.gain.value).toBe(0.5);
  });

  it('setGain() clamps to [0, 2]', async () => {
    await mixer.start();
    const id = mixer.addFileElement({} as HTMLAudioElement);
    const calls = ctxMock.createGain.mock.results;
    const sourceGain = calls[calls.length - 1].value as ReturnType<typeof makeGainNode>;

    mixer.setGain(id, -1);
    expect(sourceGain.gain.value).toBe(0);
    mixer.setGain(id, 99);
    expect(sourceGain.gain.value).toBe(2);
  });

  it('setGain() is a no-op for unknown ids', async () => {
    await mixer.start();
    expect(() => mixer.setGain('ghost', 1)).not.toThrow();
  });

  // --- removeSource ---

  it('removeSource() disconnects nodes and removes from entries', async () => {
    await mixer.start();
    const id = mixer.addFileElement({} as HTMLAudioElement);
    expect(mixer.entries).toHaveLength(1);
    mixer.removeSource(id);
    expect(mixer.entries).toHaveLength(0);
    expect(ctxMock._elementSourceNode.disconnect).toHaveBeenCalled();
  });

  // --- analysis ---

  it('analysis returns null before start()', () => {
    expect(mixer.analysis).toBeNull();
  });

  it('analysis returns an object with getFrequencyData/getTimeDomainData after start()', async () => {
    await mixer.start();
    const a = mixer.analysis;
    expect(a).not.toBeNull();
    expect(typeof a!.getFrequencyData).toBe('function');
    expect(typeof a!.getTimeDomainData).toBe('function');
  });

  // --- stop ---

  it('stop() closes the AudioContext', async () => {
    await mixer.start();
    mixer.stop();
    expect(ctxMock.close).toHaveBeenCalled();
  });

  it('stop() clears all entries', async () => {
    await mixer.start();
    mixer.addFileElement({} as HTMLAudioElement);
    mixer.addFileElement({} as HTMLAudioElement);
    mixer.stop();
    expect(mixer.entries).toHaveLength(0);
  });
});
