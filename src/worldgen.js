import Program from './worldgen.wasm';

export default ({
  frequency = 0.009,
  seed = Math.floor(Math.random() * 2147483647),
  volume,
}) => {
  const size = volume.width * volume.height * volume.depth;
  const pages = Math.ceil(size / 65536) + 10;
  const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
  return Program()
    .then((program) => (
      WebAssembly
        .instantiate(program, { env: { memory } })
        .then((instance) => {
          const voxels = instance.exports.malloc(size);
          instance.exports.generate(
            voxels,
            volume.width,
            volume.height,
            volume.depth,
            frequency,
            seed
          );
          volume.memory.voxels.view.set(new Uint8Array(memory.buffer, voxels, size));
        })
    ));
};
