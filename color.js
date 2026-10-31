const clamp = value => Math.max(0, Math.min(255, value));

export function supportsColorAdjustments(effect, settings) {
  if (effect === 'onebit') return false;
  if (['ascii', 'dense', 'ansi', 'sjis', 'petscii', 'braille'].includes(effect)) {
    return Boolean(settings.color);
  }
  if (['bayer', 'floyd', 'atkinson'].includes(effect)) {
    return ['cga', 'ansi'].includes(settings.palette);
  }
  return true;
}

// HSL rotation keeps neutral grays neutral. All adjustments precede quantization.
// Alpha is never adjusted; the source ImageData is a working copy.
export function adjustColors(data, settings, effect) {
  const factor = (259 * (Number(settings.contrast || 0) + 255)) /
    (255 * (259 - Number(settings.contrast || 0)));
  const brightness = Number(settings.brightness || 0);
  const useColor = supportsColorAdjustments(effect, settings);
  const hue = useColor ? Number(settings.hue || 0) / 360 : 0;
  const saturation = useColor ? Number(settings.saturation ?? 100) / 100 : 1;
  if (factor === 1 && brightness === 0 && hue === 0 && saturation === 1 && !settings.invertColors) return data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    if (hue !== 0 || saturation !== 1) {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const delta = max - min, lightness = (max + min) / 2;
      let h = 0, s = 0;
      if (delta > 0) {
        s = delta / (1 - Math.abs(2 * lightness - 1));
        h = max === r ? ((g - b) / delta + 6) % 6 :
          max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        h /= 6;
      }
      h = ((h + hue) % 1 + 1) % 1;
      s = Math.min(1, s * saturation);
      const chroma = (1 - Math.abs(2 * lightness - 1)) * s;
      const x = chroma * (1 - Math.abs((h * 6) % 2 - 1));
      const offset = lightness - chroma / 2;
      const sector = Math.min(5, Math.floor(h * 6));
      if (sector === 0) {r=chroma;g=x;b=0;}
      else if (sector === 1) {r=x;g=chroma;b=0;}
      else if (sector === 2) {r=0;g=chroma;b=x;}
      else if (sector === 3) {r=0;g=x;b=chroma;}
      else if (sector === 4) {r=x;g=0;b=chroma;}
      else {r=chroma;g=0;b=x;}
      r+=offset;g+=offset;b+=offset;
    }
    r=clamp(factor*(r*255-128)+128+brightness);
    g=clamp(factor*(g*255-128)+128+brightness);
    b=clamp(factor*(b*255-128)+128+brightness);
    data[i]=settings.invertColors?255-r:r;
    data[i+1]=settings.invertColors?255-g:g;
    data[i+2]=settings.invertColors?255-b:b;
  }
  return data;
}
