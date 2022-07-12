import Program from './volume.wasm';

class Volume {
  constructor({
    chunkSize = 32,
    mapping = (f, v) => (v - 1),
    width,
    height,
    depth,
    onLoad,
    onError,
  }) {
    if (width % chunkSize || height % chunkSize || depth % chunkSize) {
      if (onError) {
        onError(new Error(`width, height and depth must be multiples of ${chunkSize}`));
      }
      return;
    }
    this.chunkSize = chunkSize;
    this.width = width;
    this.height = height;
    this.depth = depth;
    const layout = [
      { id: 'volume', type: Int32Array, size: 3 },
      { id: 'voxels', type: Uint8Array, size: width * height * depth },
      { id: 'height', type: Uint32Array, size: width * depth },
      { id: 'light', type: Uint8Array, size: width * height * depth },
      { id: 'obstacles', type: Uint8Array, size: width * height * depth },
      { id: 'faces', type: Float32Array, size: Math.ceil((chunkSize ** 3) * 0.5) * 6 * 5 },
      { id: 'box', type: Uint32Array, size: 6 },
      { id: 'sphere', type: Float32Array, size: 4 },
      { id: 'queueA', type: Int32Array, size: width * depth },
      { id: 'queueB', type: Int32Array, size: width * depth },
      { id: 'queueC', type: Int32Array, size: width * depth },
    ];
    const pages = Math.ceil(layout.reduce((total, { type, size }) => (
      total + size * type.BYTES_PER_ELEMENT
    ), 0) / 65536) + 10;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
    Program()
      .then((program) => (
        WebAssembly
          .instantiate(program, { env: { memory, mapping } })
          .then((instance) => {
            this.memory = layout.reduce((layout, { id, type, size }) => {
              const address = instance.exports.malloc(size * type.BYTES_PER_ELEMENT);
              layout[id] = {
                address,
                view: new type(memory.buffer, address, size),
              };
              return layout;
            }, {});
            this.memory.volume.view.set([width, height, depth]);
            this._ground = instance.exports.ground;
            this._mesh = instance.exports.mesh;
            this._pathfind = instance.exports.pathfind;
            this._propagate = instance.exports.propagate;
            this._update = instance.exports.update;
            this._voxel = instance.exports.voxel;
          })
      ))
      .then(() => {
        if (onLoad) {
          onLoad();
        }
      })
      .catch((e) => {
        if (onError) {
          onError(e);
        }
      });
  }

  ground(position, height = 1) {
    const { memory, _ground } = this;
    return _ground(
      memory.volume.address,
      memory.voxels.address,
      height,
      position.x,
      position.y,
      position.z
    );
  }

  mesh(chunk) {
    const { chunkSize, memory, _mesh } = this;
    const count = _mesh(
      memory.volume.address,
      memory.voxels.address,
      memory.light.address,
      memory.faces.address,
      memory.sphere.address,
      chunkSize,
      chunk.x,
      chunk.y,
      chunk.z
    );
    return {
      bounds: memory.sphere.view,
      count,
      faces: new Float32Array(memory.faces.view.subarray(0, count * 5)),
    };
  }

  obstacle(position, enabled, height = 1) {
    const { memory } = this;
    for (let y = 0; y < height; y++) {
      const voxel = this.voxel(position);
      if (voxel !== -1) {
        memory.obstacles.view[voxel] = enabled ? 1 : 0;
      }
    }
  }

  pathfind({
    from,
    to,
    height = 1,
    maxVisited = 4096,
    minY = 0,
    maxY = Infinity,
  }) {
    const { memory, _pathfind } = this;
    const nodes = _pathfind(
      memory.volume.address,
      memory.voxels.address,
      memory.obstacles.address,
      memory.queueA.address,
      height,
      maxVisited,
      Math.max(minY, 0),
      Math.min(maxY, this.height - 1),
      from.x,
      from.y,
      from.z,
      to.x,
      to.y,
      to.z
    );
    return memory.queueA.view.subarray(0, nodes * 3);
  }

  propagate() {
    const { memory, _propagate } = this;
    _propagate(
      memory.volume.address,
      memory.voxels.address,
      memory.height.address,
      memory.light.address,
      memory.queueA.address,
      memory.queueB.address
    );
    return this;
  }

  update(position, value, updateLight = true) {
    const { memory, _update } = this;
    _update(
      memory.box.address,
      memory.volume.address,
      memory.voxels.address,
      memory.height.address,
      memory.light.address,
      memory.queueA.address,
      memory.queueB.address,
      memory.queueC.address,
      position.x,
      position.y,
      position.z,
      value,
      updateLight
    );
    return memory.box.view;
  }

  voxel(position) {
    const { memory, _voxel } = this;
    return _voxel(
      memory.volume.address,
      position.x,
      position.y,
      position.z
    );
  }
}

export default Volume;
