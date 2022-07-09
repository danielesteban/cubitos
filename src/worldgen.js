import Program from './worldgen.wasm';
import Worker from 'web-worker:./worldgen.worker.js';

export default ({
  frequency = 0.01,
  seed = Math.floor(Math.random() * 2147483647),
  volume,
}) => (
  Program().then((program) => new Promise((resolve) => {
    const worker = new Worker();
    worker.addEventListener('message', ({ data }) => {
      volume.memory.voxels.view.set(data);
      worker.terminate();
      resolve(volume);
    });
    worker.postMessage({
      program,
      width: volume.width,
      height: volume.height,
      depth: volume.depth,
      frequency,
      seed,
    });
  }))
);
