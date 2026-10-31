import {renderProcessedImage} from './processing.js';

self.onmessage = ({data: message}) => {
  try {
    const {canvas, text, grid} = renderProcessedImage(message.bitmap, message.effect, message.s);
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({id: message.id, bitmap, text, grid}, [bitmap]);
  } catch (error) {
    self.postMessage({id: message.id, error: error.message});
  } finally {
    message.bitmap.close();
  }
};
