self.addEventListener('message', ({
  data: {
    program,
    width,
    height,
    depth,
    frequency,
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
        frequency,
        seed
      );
      self.postMessage(new Uint8Array(memory.buffer, voxels, size));
    })
});