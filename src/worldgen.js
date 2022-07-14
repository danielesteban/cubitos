import Program from './worldgen.wasm';
import Worker from 'web-worker:./worldgen.worker.js';

export default ({
  grass = true,
  lights = true,
  frequency = 0.01,
  gain = 0.5,
  lacunarity = 2,
  octaves = 3,
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
      grass,
      lights,
      frequency,
      gain,
      lacunarity,
      octaves,
      seed,
    });
  }))
);
