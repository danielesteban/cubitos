self.addEventListener('message', ({
  data: {
    program,
    width,
    height,
    grass,
    lights,
    depth,
    frequency,
    gain,
    lacunarity,
    octaves,
    seed,
  },
}) => {
  const size = width * height * depth;
  const pages = Math.ceil(size / 65536) + 10;
  const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
  WebAssembly
    .instantiate(program, { env: { memory } })
    .then((instance) => {
      const voxels = instance.exports.malloc(size);
      instance.exports.generate(
        voxels,
        width,
        height,
        depth,
        grass ? 1 : 0,
        lights ? 1 : 0,
        frequency,
        gain,
        lacunarity,
        octaves,
        seed
      );
      self.postMessage(new Uint8Array(memory.buffer, voxels, size));
    })
});
