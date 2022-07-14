import {
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
	InterleavedBufferAttribute,
  Mesh,
  PlaneGeometry,
  Sphere,
} from 'three';

class Chunk extends Mesh {
  static setupGeometry() {
    const plane = new PlaneGeometry(1, 1, 1, 1);
    plane.translate(0, 0, 0.5);
    const uv = plane.getAttribute('uv');
    for (let i = 0, l = uv.count; i < l; i++) {
      uv.setXY(i, uv.getX(i), 1.0 - uv.getY(i));
    }
    Chunk.geometry = {
      index: plane.getIndex(),
      position: plane.getAttribute('position'),
      normal: plane.getAttribute('normal'),
      uv,
    };
  }

  constructor({ material, position, volume }) {
    if (!Chunk.geometry) {
      Chunk.setupGeometry();
    }
    const geometry = new InstancedBufferGeometry();
    geometry.boundingSphere = new Sphere();
    geometry.setIndex(Chunk.geometry.index);
    geometry.setAttribute('position', Chunk.geometry.position);
    geometry.setAttribute('normal', Chunk.geometry.normal);
    geometry.setAttribute('uv', Chunk.geometry.uv);
    super(geometry, material);
    this.matrixAutoUpdate = false;
    this.position.copy(position).multiplyScalar(volume.chunkSize);
    this.volume = volume;
    this.updateMatrix();
    this.update();
  }

  update() {
    const { geometry, position, volume } = this;
    const { bounds, count, faces } = volume.mesh(position);
    if (!count) {
      this.visible = false;
      return;
    }
    geometry.boundingSphere.center.set(bounds[0], bounds[1], bounds[2]);
    geometry.boundingSphere.radius = bounds[3];
    const buffer = new InstancedInterleavedBuffer(faces, 8, 1);
    geometry.setAttribute('face', new InterleavedBufferAttribute(buffer, 4, 0));
    geometry.setAttribute('light', new InterleavedBufferAttribute(buffer, 4, 4));
    geometry.instanceCount = geometry._maxInstanceCount = count;
    this.visible = true;
  }
}

export default Chunk;
