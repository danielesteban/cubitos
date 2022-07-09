#define FNL_IMPL
#include "../vendor/FastNoiseLite/C/FastNoiseLite.h"

void generate(
  unsigned char* voxels,
  const int width,
  const int height,
  const int depth,
  const float frequency,
  const int seed
) {
  fnl_state noise = fnlCreateState();
  noise.fractal_type = FNL_FRACTAL_FBM;
  noise.frequency = frequency;
  noise.seed = seed;
  const float radius = fmax(width, depth) * 0.5f;
  for (int i = 0, z = 0; z < depth; z++) {
    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++, i++) {
        const float dx = (x - width * 0.5f + 0.5f);
        const float dz = (z - depth * 0.5f + 0.5f);
        const float d = sqrt(dx * dx + dz * dz);
        if (d > radius) {
          continue;
        }
        const float n = fnlGetNoise3D(&noise, x, y, z);
        if (
          fabs((float) (height - 2) * n) >= y
          && d < radius * (0.8f + fabs(n) * 0.2f)
        ) {
          voxels[i] = 1;
        } else if (y > 0 && voxels[i - width] == 1) {
          voxels[i - width] = 2;
        }
      }
    }
  }
}
