import {
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Sphere,
  Vector4,
} from 'three';

const _face = new Vector4();
const _intersects = [];
const _sphere = new Sphere();
const _translation = new Matrix4();

class Chunk extends Mesh {
  static setupGeometry() {
    const face = new PlaneGeometry(1, 1, 1, 1);
    face.translate(0, 0, 0.5);
    const uv = face.getAttribute('uv');
    for (let i = 0, l = uv.count; i < l; i++) {
      uv.setXY(i, uv.getX(i), 1.0 - uv.getY(i));
    }
    Chunk.geometry = {
      index: face.getIndex(),
      position: face.getAttribute('position'),
      normal: face.getAttribute('normal'),
      uv,
      instance: new Mesh(face),
      rotations: Array.from({ length: 6 }, (v, i) => {
        const rotation = new Matrix4();
        switch (i) {
          case 1:
            rotation.makeRotationX(Math.PI * -0.5);
            break;
          case 2:
            rotation.makeRotationX(Math.PI * 0.5);
            break;
          case 3:
            rotation.makeRotationY(Math.PI * -0.5);
            break;
          case 4:
            rotation.makeRotationY(Math.PI * 0.5);
            break;
          case 5:
            rotation.makeRotationY(Math.PI);
            break;
        }
        return rotation;
      }),
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

  raycast(raycaster, intersects) {
    const { instance, rotations } = Chunk.geometry;
    const { geometry, matrixWorld, visible } = this;
    if (!visible) {
      return;
    }
    _sphere.copy(geometry.boundingSphere);
    _sphere.applyMatrix4(matrixWorld);
    if (!raycaster.ray.intersectsSphere(_sphere)) {
      return;
    }
    const face = geometry.getAttribute('face');
    for (let i = 0, l = geometry.instanceCount; i < l; i++) {
      _face.fromBufferAttribute(face, i);
      instance.matrixWorld
        .multiplyMatrices(matrixWorld, _translation.makeTranslation(_face.x, _face.y, _face.z))
        .multiply(rotations[Math.floor(_face.w % 6)]);
      instance.raycast(raycaster, _intersects);
      _intersects.forEach((intersect) => {
        intersect.object = this;
        intersect.face.normal.transformDirection(instance.matrixWorld);
        intersects.push(intersect);
      });
      _intersects.length = 0;
    }
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
