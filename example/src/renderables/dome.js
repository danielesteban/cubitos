import {
  BackSide,
  Color,
  DataTexture,
  FloatType,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  RedFormat,
  RepeatWrapping,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
} from 'three';

const Noise = (size = 256) => {
  const data = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    data[i] = Math.random();
  }
  const texture = new DataTexture(data, size, size, RedFormat, FloatType);
  texture.needsUpdate = true;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
};

class Dome extends Mesh {
  static setupGeometry() {
    const geometry = new IcosahedronGeometry(512, 3);
    geometry.deleteAttribute('normal');
    Dome.geometry = geometry;
  }

  static setupMaterial() {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    Dome.material = new ShaderMaterial({
      side: BackSide,
      uniforms: {
        ...UniformsUtils.clone(uniforms),
        diffuse: { value: new Color(0.003, 0.005, 0.008) },
        noise: { value: Noise() },
      },
      vertexShader: vertexShader
        .replace(
          '#include <common>',
          [
            'varying vec3 fragNormal;',
            'varying float vAltitude;',
            'varying vec2 vNoiseUV;',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )',
          '#if 1'
        )
        .replace(
          '#include <begin_vertex>',
          [
            'fragNormal = transformedNormal;',
            '#include <begin_vertex>',
          ].join('\n')
        )
        .replace(
          'include <fog_vertex>',
          [
            'include <fog_vertex>',
            'vAltitude = (normalize(position).y + 1.0) * 0.5;',
            'vNoiseUV = uv * vec2(2.0, 4.0);',
            'gl_Position = gl_Position.xyww;',
          ].join('\n')
        ),
      fragmentShader: fragmentShader
        .replace(
          '#include <common>',
          [
            'layout(location = 1) out vec4 pc_fragNormal;',
            'varying vec3 fragNormal;',
            'varying float vAltitude;',
            'varying vec2 vNoiseUV;',
            'uniform sampler2D noise;',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          [
            'vec4 diffuseColor = vec4(mix(diffuse * 0.5, diffuse * 1.5, vAltitude), opacity);',
            'vec3 granularity = diffuse * 0.03;',
            'diffuseColor.rgb += mix(-granularity, granularity, texture(noise, vNoiseUV).r);',
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
    if (!Dome.geometry) {
      Dome.setupGeometry();
    }
    if (!Dome.material) {
      Dome.setupMaterial();
    }
    super(
      Dome.geometry,
      Dome.material
    );
    this.frustumCulled = false;
    this.matrixAutoUpdate = false;
    this.renderOrder = 1;
  }
}

export default Dome;
