import {dither} from './dither.js';
import {adjustColors} from './color.js';
import {spectrum, teletext} from './vintage.js';
import {renderCharacters, textEffects} from './characters.js';

export const MAX_RASTER_PIXELS = 24000000;

export function rasterDimensions(width, height, resolution = 'original') {
  const scale = resolution === 'preview' ? Math.min(1, 1200 / Math.max(width, height)) : 1;
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

// A pixel-size unit always means one output-image pixel, never one CSS pixel.
// Partial blocks at the right/bottom edge are cropped, not stretched or rounded up.
export function sampleBlocks(data, width, height, size) {
  const cols = Math.ceil(width / size), rows = Math.ceil(height / size);
  if (size === 1) return {pixels: data, cols, rows};
  const pixels = new Uint8ClampedArray(cols * rows * 4);
  for (let by = 0; by < rows; by++) for (let bx = 0; bx < cols; bx++) {
    let red = 0, green = 0, blue = 0, alpha = 0, count = 0;
    for (let y = by * size; y < Math.min(height, (by + 1) * size); y++) {
      for (let x = bx * size; x < Math.min(width, (bx + 1) * size); x++) {
        const i = (y * width + x) * 4, a = data[i + 3];
        red += data[i] * a; green += data[i + 1] * a; blue += data[i + 2] * a;
        alpha += a; count++;
      }
    }
    const index = (by * cols + bx) * 4;
    pixels[index]=alpha?red/alpha:0;pixels[index+1]=alpha?green/alpha:0;
    pixels[index+2]=alpha?blue/alpha:0;pixels[index+3]=alpha/count;
  }
  return {pixels, cols, rows};
}

export function expandBlocks(pixels, width, height, size) {
  if (size === 1) return pixels;
  const cols = Math.ceil(width / size), out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = (Math.floor(y / size) * cols + Math.floor(x / size)) * 4;
    const to=(y*width+x)*4;
    out[to]=pixels[from];out[to+1]=pixels[from+1];
    out[to+2]=pixels[from+2];out[to+3]=pixels[from+3];
  }
  return out;
}

export function renderProcessedImage(source, effect, settings) {
  // Both the worker and browser regression tests use this single pipeline.
  if (textEffects.includes(effect)) {
    const result = renderCharacters(source, effect, settings);
    return {...result, grid: `${result.cols} × ${result.rows} characters`};
  }
  const vintage = ['zx', 'teletext'].includes(effect);
  let {width, height} = rasterDimensions(source.width, source.height, settings.exportSize);
  if (effect === 'zx') { width = 256; height = 192; }
  if (effect === 'teletext') { width = 160; height = Math.max(3, Math.round(source.height / source.width * width / 3) * 3); }
  if (width * height > MAX_RASTER_PIXELS) {
    throw new Error('Original resolution supports up to 24 megapixels. Choose Reduced · max 1200 px in Processing resolution.');
  }
  let canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (effect === 'zx') {
    context.fillStyle = '#000'; context.fillRect(0, 0, width, height);
    const scale = Math.min(width / source.width, height / source.height);
    context.drawImage(source, (width - source.width * scale) / 2,
      (height - source.height * scale) / 2, source.width * scale, source.height * scale);
  } else context.drawImage(source, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  adjustColors(image.data, settings, effect);
  if (effect === 'zx') image.data.set(spectrum(image.data, width, height));
  else if (effect === 'teletext') image.data.set(teletext(image.data, width, height));
  else if (effect !== 'original') {
    const size = Math.max(1, Math.min(8, Math.round(Number(settings.pixelSize) || 1)));
    const {pixels, cols, rows} = sampleBlocks(image.data, width, height, size);
    const quantized = dither(pixels, cols, rows, effect, settings);
    image.data.set(expandBlocks(quantized, width, height, size));
  }
  context.putImageData(image, 0, 0);
  if (vintage && Number(settings.enlarge) > 1) {
    const scale = Number(settings.enlarge);
    const enlarged = new OffscreenCanvas(width * scale, height * scale);
    const enlargedContext = enlarged.getContext('2d');
    enlargedContext.imageSmoothingEnabled = false;
    enlargedContext.drawImage(canvas, 0, 0, enlarged.width, enlarged.height);
    canvas = enlarged;
  }
  return {canvas, text: '', grid: vintage ? `${width} × ${height} native grid` : ''};
}
