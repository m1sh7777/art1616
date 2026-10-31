// Cache the processed pixels, not a zoomed or downscaled rendering of them.
// Preview, PNG and text exports all wait for the same current result.
export class ProcessedPreview {
  constructor(capture, compute, commit) {
    this.capture = capture;
    this.compute = compute;
    this.commit = commit;
    this.sourceIds = new WeakMap();
    this.nextSourceId = 0;
    this.jobs = new Map();
    this.result = null;
  }

  snapshot() {
    const state = this.capture();
    if (!this.sourceIds.has(state.source)) this.sourceIds.set(state.source, ++this.nextSourceId);
    const settings = {...state.settings};
    const key = JSON.stringify([this.sourceIds.get(state.source), state.effect, settings]);
    return {...state, settings, key};
  }

  async render(state) {
    if (this.result?.key === state.key) return this.result;
    if (this.jobs.has(state.key)) return this.jobs.get(state.key);
    const job = (async () => {
      const processed = await this.compute(state.source, state.effect, state.settings);
      const canvas = document.createElement('canvas');
      canvas.width = processed.bitmap.width;
      canvas.height = processed.bitmap.height;
      canvas.getContext('2d').drawImage(processed.bitmap, 0, 0);
      processed.bitmap.close();
      const result = {canvas, text: processed.text, grid: processed.grid,
        key: state.key, effect: state.effect, settings: state.settings, source: state.source};
      // An earlier slider/effect request cannot overwrite the latest image.
      if (state.key === this.snapshot().key) {
        this.result = result;
        this.commit(result);
      }
      return result;
    })();
    this.jobs.set(state.key, job);
    try { return await job; } finally { this.jobs.delete(state.key); }
  }

  async ensureCurrent() {
    while (true) {
      const result = await this.render(this.snapshot());
      if (result.key === this.snapshot().key) return result;
    }
  }
}
