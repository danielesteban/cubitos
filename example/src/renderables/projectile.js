import {
  BufferAttribute,
  Color,
  IcosahedronGeometry,
  Mesh,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
  Vector3,
} from 'three';

class Projectile extends Mesh {
  static setupGeometry() {
    const geometry = new IcosahedronGeometry(0.25, 3);
    geometry.deleteAttribute('uv');
    const color = new BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3), 3);
    let light;
    for (let i = 0; i < color.count; i++) {
      if (i % 3 === 0) {
        light = 1 - Math.random() * 0.1;
      }
      color.setXYZ(i, light, light, light);
    }
    geometry.setAttribute('color', color);
    Projectile.geometry = geometry;
  }

  static setupMaterial() {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    Projectile.material = new ShaderMaterial({
      vertexColors: true,
      uniforms: UniformsUtils.clone(uniforms),
      vertexShader: vertexShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'varying vec3 fragNormal;',
          ].join('\n')
        )
        .replace(
          '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )',
          '#if 1'
        )
        .replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'fragNormal = transformedNormal;',
          ].join('\n')
        ),
      fragmentShader: fragmentShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'layout(location = 1) out vec4 pc_fragNormal;',
            'varying vec3 fragNormal;',
          ].join('\n')
        )
        .replace(
          '#include <dithering_fragment>',
          [
            '#include <dithering_fragment>',
            'pc_fragNormal = vec4(normalize(fragNormal), 0.0);',
          ].join('\n')
        ),
    });
  }

  constructor() {
    if (!Projectile.geometry) {
      Projectile.setupGeometry();
    }
    if (!Projectile.material) {
      Projectile.setupMaterial();
    }
    super(Projectile.geometry, Projectile.material);
    this.color = new Color();
    this.direction = new Vector3();
  }

  onAnimationTick(step) {
    const { position, direction } = this;
    position.addScaledVector(direction, step);
    this.distance += step;
  }

  onBeforeRender() {
    const { color, material } = this;
    material.uniforms.diffuse.value.copy(color);
    material.uniformsNeedUpdate = true;
  }
}

export default Projectile;
