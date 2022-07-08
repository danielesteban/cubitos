import Program from './volume.wasm';

class Volume {
  constructor({
    width,
    height,
    depth,
    onLoad,
    onError,
  }) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    const layout = [
      { id: 'obstacles', type: Uint8Array, size: width * height * depth },
      { id: 'voxels', type: Uint8Array, size: width * height * depth },
      { id: 'path', type: Int32Array, size: 4096 },
      { id: 'volume', type: Int32Array, size: 3 },
    ];
    const pages = Math.ceil(layout.reduce((total, { type, size }) => (
      total + size * type.BYTES_PER_ELEMENT
    ), 0) / 65536) + 10;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
    Program()
      .then((program) => (
        WebAssembly
          .instantiate(program, { env: { memory } })
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
            this._pathfind = instance.exports.pathfind;
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
      memory.path.address,
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
    if (nodes === -1) {
      throw new Error('Requested path is out of bounds');
    }
    return memory.path.view.subarray(0, nodes * 3);
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
