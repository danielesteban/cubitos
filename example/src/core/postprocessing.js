import {
  DepthTexture,
  FloatType,
  GLSL3,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Vector2,
  WebGLMultipleRenderTargets,
} from 'three';

class PostProcessing {
  constructor({ samples }) {
    const plane = new PlaneGeometry(2, 2, 1, 1);
    plane.deleteAttribute('normal');
    plane.deleteAttribute('uv');
    this.target = new WebGLMultipleRenderTargets(window.innerWidth, window.innerHeight, 2, {
      depthTexture: new DepthTexture(window.innerWidth, window.innerHeight, FloatType),
      samples,
      type: FloatType,
    });
    this.screen = new Mesh(
      plane,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        uniforms: {
          colorTexture: { value: this.target.texture[0] },
          depthTexture: { value: this.target.depthTexture },
          normalTexture: { value: this.target.texture[1] },
          resolution: { value: new Vector2(this.target.width, this.target.height) },
          cameraNear: { value: 0 },
          cameraFar: { value: 0 },
          intensity: { value: 0.5 },
          thickness: { value: 0.5 },
          depthBias: { value: 1 },
          depthScale: { value: 1.5 },
          normalBias: { value: 1 },
          normalScale: { value: 0.5 },
        },
        vertexShader: [
          'precision highp float;',
          'in vec3 position;',
          'out vec2 uv;',
          'void main() {',
          '  gl_Position = vec4(position.xy, 0, 1);',
          '  uv = position.xy * 0.5 + 0.5;',
          '}',
        ].join('\n'),
        fragmentShader: [
          'precision highp float;',
          'in vec2 uv;',
          'out vec4 fragColor;',
          'uniform sampler2D colorTexture;',
          'uniform sampler2D depthTexture;',
          'uniform sampler2D normalTexture;',
          'uniform vec2 resolution;',
          'uniform float cameraNear;',
          'uniform float cameraFar;',
          'uniform float intensity;',
          'uniform float thickness;',
          'uniform float depthBias;',
          'uniform float depthScale;',
          'uniform float normalBias;',
          'uniform float normalScale;',
          '#define saturate(a) clamp(a, 0.0, 1.0)',
          'float LinearizeDepth(float depth) {',
          '  return cameraFar * cameraNear / ((cameraNear - cameraFar) * depth + cameraFar);',
          '}',
          'vec3 LinearToSRGB(const in vec3 value) {',
          '  return vec3(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))));',
          '}',
          'vec3 SobelSample(const in sampler2D tex, const in vec2 uv, const in vec3 offset) {',
          '  vec3 pixelCenter = texture(tex, uv).rgb;',
          '  vec3 pixelLeft   = texture(tex, uv - offset.xz).rgb;',
          '  vec3 pixelRight  = texture(tex, uv + offset.xz).rgb;',
          '  vec3 pixelUp     = texture(tex, uv + offset.zy).rgb;',
          '  vec3 pixelDown   = texture(tex, uv - offset.zy).rgb;',
          '  return (',
          '    abs(pixelLeft    - pixelCenter)',
          '    + abs(pixelRight - pixelCenter)',
          '    + abs(pixelUp    - pixelCenter)',
          '    + abs(pixelDown  - pixelCenter)',
          '  );',
          '}',
          'float SobelSampleDepth(const in sampler2D tex, const in vec2 uv, const in vec3 offset) {',
          '  float pixelCenter = LinearizeDepth(texture(tex, uv).r);',
          '  float pixelLeft   = LinearizeDepth(texture(tex, uv - offset.xz).r);',
          '  float pixelRight  = LinearizeDepth(texture(tex, uv + offset.xz).r);',
          '  float pixelUp     = LinearizeDepth(texture(tex, uv + offset.zy).r);',
          '  float pixelDown   = LinearizeDepth(texture(tex, uv - offset.zy).r);',
          '  return (',
          '    abs(pixelLeft    - pixelCenter)',
          '    + abs(pixelRight - pixelCenter)',
          '    + abs(pixelUp    - pixelCenter)',
          '    + abs(pixelDown  - pixelCenter)',
          '  );',
          '}',
          'vec3 composite(const in vec2 uv) {',
          '  vec3 offset = vec3((1.0 / resolution.x), (1.0 / resolution.y), 0.0) * thickness;',
          '  float sobelDepth = SobelSampleDepth(depthTexture, uv, offset);',
          '  sobelDepth = pow(saturate(sobelDepth) * depthScale, depthBias);',
          '  vec3 sobelNormalVec = SobelSample(normalTexture, uv, offset);',
          '  float sobelNormal = sobelNormalVec.x + sobelNormalVec.y + sobelNormalVec.z;',
          '  sobelNormal = pow(sobelNormal * normalScale, normalBias);',
          '  vec3 color = texture(colorTexture, uv).rgb;',
          '  return mix(color, vec3(0.0), saturate(max(sobelDepth, sobelNormal)) * intensity);',
          '}',
          'void main() {',
          '  fragColor = vec4(LinearToSRGB(composite(uv)), 1.0);',
          // '  gl_FragDepth = texture(depthTexture, uv).r;',
          '}',
        ].join('\n'),
      })
    );
    this.screen.frustumCulled = false;
    this.screen.matrixAutoUpdate = false;
  }

  onResize(width, height) {
    const { screen, target } = this;
    target.setSize(width, height);
    screen.material.uniforms.resolution.value.set(width, height);
  }

  render(renderer, scene, camera) {
    const { screen, target } = this;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    screen.material.uniforms.cameraNear.value = camera.near;
    screen.material.uniforms.cameraFar.value = camera.far;
    renderer.render(screen, camera);
  }
}

export default PostProcessing;
