#include <stdbool.h>
#include "../vendor/AStar/AStar.c"

typedef struct {
  int x;
  int y;
  int z;
} Voxel;

typedef struct {
  Voxel min;
  Voxel max;
} Box;

typedef struct {
  const int width;
  const int height;
  const int depth;
  const int chunkSize;
  const int maxLight;
} Volume;

typedef struct {
  const Volume* volume;
  const unsigned char* voxels;
  const unsigned char* obstacles;
  const int height;
  const int maxVisited;
  const int minY;
  const int maxY;
} PathContext;

enum LightChannels {
  LIGHT_CHANNEL_SUNLIGHT,
  LIGHT_CHANNEL_LIGHT1,
  LIGHT_CHANNEL_LIGHT2,
  LIGHT_CHANNEL_LIGHT3,
  LIGHT_CHANNELS
};

typedef unsigned char Light[LIGHT_CHANNELS];

static const Voxel lightNeighbors[6] = {
  { 0, -1, 0 },
  { 0, 1, 0 },
  { -1, 0, 0 },
  { 1, 0, 0 },
  { 0, 0, -1 },
  { 0, 0, 1 }
};

static const Voxel meshNormals[6][3] = {
  { { 0, 0, 1 },    { 0, 1, 0 },    { 1, 0, 0 }, },
  { { 0, 1, 0 },    { 0, 0, -1 },   { 1, 0, 0 }, },
  { { 0, -1, 0 },   { 0, 0, 1 },    { 1, 0, 0 }, },
  { { -1, 0, 0 },   { 0, 1, 0 },    { 0, 0, 1 }, },
  { { 1, 0, 0 },    { 0, 1, 0 },    { 0, 0, 1 }, },
  { { 0, 0, -1 },   { 0, 1, 0 },    { -1, 0, 0 } },
};

static const int meshLightSamples[] = {
  0, 0,
  -1, 0,
  1, 0,
  0, -1,
  0, 1
};

static const int horizontalNeighbors[] = {
  -1, 0,
  1, 0,
  0, -1,
  0, 1
};

static const int verticalNeighbors[] = {
  0,
  1,
  -1
};

const int voxel(
  const Volume* volume,
  const int x,
  const int y,
  const int z
) {
  if (
    x < 0 || x >= volume->width
    || y < 0 || y >= volume->height
    || z < 0 || z >= volume->depth
  ) {
    return -1;
  }
  return z * volume->width * volume->height + y * volume->width + x;
}

static void grow(
  Box* box,
  const int x,
  const int y,
  const int z
) {
  if (box == NULL) return;
  if (box->min.x > x) box->min.x = x;
  if (box->min.y > y) box->min.y = y;
  if (box->min.z > z) box->min.z = z;
  if (box->max.x < x) box->max.x = x;
  if (box->max.y < y) box->max.y = y;
  if (box->max.z < z) box->max.z = z;
}

static void floodLight(
  Box* bounds,
  const unsigned char channel,
  const Volume* volume,
  unsigned char* voxels,
  int* height,
  Light* light,
  int* queue,
  const unsigned int size,
  int* next
) {
  unsigned int nextLength = 0;
  for (unsigned int q = 0; q < size; q++) {
    const int i = queue[q];
    const unsigned char level = light[i][channel];
    if (level == 0) {
      continue;
    }
    const int z = floor(i / (volume->width * volume->height)),
              y = floor((i % (volume->width * volume->height)) / volume->width),
              x = floor((i % (volume->width * volume->height)) % volume->width);
    for (unsigned char n = 0; n < 6; n++) {
      const int nx = x + lightNeighbors[n].x,
                ny = y + lightNeighbors[n].y,
                nz = z + lightNeighbors[n].z,
                neighbor = voxel(volume, nx, ny, nz);
      const unsigned char nl = level - (
        channel == LIGHT_CHANNEL_SUNLIGHT && n == 0 && level == volume->maxLight ? 0 : 1
      );
      if (
        neighbor == -1
        || light[neighbor][channel] >= nl
        || voxels[neighbor]
        || (
          channel == LIGHT_CHANNEL_SUNLIGHT
          && n != 0
          && level == volume->maxLight
          && ny > height[nz * volume->width + nx]
        )
      ) {
        continue;
      }
      light[neighbor][channel] = nl;
      next[nextLength++] = neighbor;
      grow(bounds, nx, ny, nz);
    }
  }
  if (nextLength > 0) {
    floodLight(
      bounds,
      channel,
      volume,
      voxels,
      height,
      light,
      next,
      nextLength,
      queue
    );
  }
}

static void removeLight(
  Box* bounds,
  const unsigned char channel,
  const Volume* volume,
  unsigned char* voxels,
  int* height,
  Light* light,
  int* queue,
  const unsigned int size,
  int* next,
  int* floodQueue,
  unsigned int floodQueueSize
) {
  unsigned int nextLength = 0;
  for (int q = 0; q < size; q += 2) {
    const int i = queue[q];
    const unsigned char level = queue[q + 1];
    const int z = floor(i / (volume->width * volume->height)),
              y = floor((i % (volume->width * volume->height)) / volume->width),
              x = floor((i % (volume->width * volume->height)) % volume->width);
    for (unsigned char n = 0; n < 6; n++) {
      const int nx = x + lightNeighbors[n].x,
                ny = y + lightNeighbors[n].y,
                nz = z + lightNeighbors[n].z,
                neighbor = voxel(volume, nx, ny, nz);
      if (neighbor == -1 || voxels[neighbor]) {
        continue;
      }
      const unsigned char nl = light[neighbor][channel];
      if (nl == 0) {
        continue;
      }
      if (
        nl < level
        || (
          channel == LIGHT_CHANNEL_SUNLIGHT
          && n == 0
          && level == volume->maxLight
          && nl == volume->maxLight
        )
      ) {
        next[nextLength++] = neighbor;
        next[nextLength++] = nl;
        light[neighbor][channel] = 0;
        grow(bounds, nx, ny, nz);
      } else if (nl >= level) {
        floodQueue[floodQueueSize++] = neighbor;
      }
    }
  }
  if (nextLength > 0) {
    removeLight(
      bounds,
      channel,
      volume,
      voxels,
      height,
      light,
      next,
      nextLength,
      queue,
      floodQueue,
      floodQueueSize
    );
    return;
  }
  if (floodQueueSize > 0) {
    floodLight(
      bounds,
      channel,
      volume,
      voxels,
      height,
      light,
      floodQueue,
      floodQueueSize,
      queue
    );
  }
}

static const float lighting(
  const Volume* volume,
  const unsigned char* voxels,
  const Light* light,
  const unsigned char face,
  const unsigned char channel,
  const int x,
  const int y,
  const int z
) {
  const int vx = meshNormals[face][1].x,
            vy = meshNormals[face][1].y,
            vz = meshNormals[face][1].z,
            ux = meshNormals[face][2].x,
            uy = meshNormals[face][2].y,
            uz = meshNormals[face][2].z;
  float level = 0.0f;
  unsigned char count = 0;
  for (int s = 0; s < 5; s++) {
    const int u = meshLightSamples[s * 2],
              v = meshLightSamples[s * 2 + 1],
              n = voxel(
                volume,
                x + ux * u + vx * v,
                y + uy * u + vy * v,
                z + uz * u + vz * v
              );
    if (s == 0 || (n != -1 && !voxels[n] && light[n][channel])) {
      level += light[n][channel];
      count++;
    }
  }
  return level / count / volume->maxLight;
}

static const bool canGoThrough(
  const PathContext* context,
  const int x,
  const int y,
  const int z
) {
  for (int h = 0; h < context->height; h++) {
    const int i = voxel(context->volume, x, y + h, z);
    if (i == -1 || context->voxels[i] || context->obstacles[i]) {
      return false;
    }
  }
  return true;
}

static const bool canStepAt(
  const PathContext* context,
  const int x,
  const int y,
  const int z
) {
  if ((y - 1) < context->minY || (y - 1) > context->maxY) {
    return false;
  }
  const int i = voxel(context->volume, x, y - 1, z);
  if (i == -1 || !context->voxels[i] || context->obstacles[i]) {
    return false;
  }
  return canGoThrough(context, x, y, z);
}

static void PathNodeNeighbors(ASNeighborList neighbors, void* pathNode, void* pathContext) {
  Voxel* node = (Voxel*) pathNode;
  PathContext* context = (PathContext*) pathContext;
  for (int i = 0; i < 8; i += 2) {
    const int x = horizontalNeighbors[i];
    const int z = horizontalNeighbors[i + 1];
    for (int j = 0; j < 3; j++) {
      const int y = verticalNeighbors[j];
      if (canStepAt(context, node->x + x, node->y + y, node->z + z)) {
        ASNeighborListAdd(neighbors, &(Voxel){node->x + x, node->y + y, node->z + z}, j > 0 ? 2 : 1);
      }
    }
  }
}

static float PathNodeHeuristic(void* fromNode, void* toNode, void* context) {
  Voxel* from = (Voxel*) fromNode;
  Voxel* to = (Voxel*) toNode;
  return abs(from->x - to->x) + abs(from->y - to->y) + abs(from->z - to->z);
}

static int EarlyExit(size_t visitedCount, void* visitingNode, void* goalNode, void* context) {
  if (visitedCount > ((PathContext*) context)->maxVisited) {
    return -1;
  }
  return 0;
}

static const ASPathNodeSource PathNodeSource = {
  sizeof(Voxel),
  &PathNodeNeighbors,
  &PathNodeHeuristic,
  &EarlyExit,
  NULL
};

const int ground(
  const Volume* volume,
  const unsigned char* voxels,
  const int height,
  const int x,
  int y,
  const int z
) {
  if (
    x < 0 || x >= volume->width
    || y < 0 || y >= volume->height
    || z < 0 || z >= volume->depth
    || voxels[voxel(volume, x, y, z)]
  ) {
    return -1;
  }
  y--;
  for (; y >= 0; y--) {
    if (!voxels[voxel(volume, x, y, z)]) {
      continue;
    }
    for (int h = 1; h <= height; h++) {
      if (voxels[voxel(volume, x, y + h, z)]) {
        return -1;
      }
    }
    return y + 1;
  }
  return 0;
}

int mapping(int face, int value, int x, int y, int z);

int mesh(
  const Volume* volume,
  const unsigned char* voxels,
  const Light* light,
  float* faces,
  float* sphere,
  Box* box,
  const int chunkX,
  const int chunkY,
  const int chunkZ
) {
  box->min.x = box->min.y = box->min.z = volume->chunkSize;
  box->max.x = box->max.y = box->max.z = 0;
  int count = 0;
  int offset = 0;
  for (int z = chunkZ; z < chunkZ + volume->chunkSize; z++) {
    for (int y = chunkY; y < chunkY + volume->chunkSize; y++) {
      for (int x = chunkX; x < chunkX + volume->chunkSize; x++) {
        const unsigned char value = voxels[voxel(volume, x, y, z)];
        if (value) {
          const int cx = x - chunkX,
                    cy = y - chunkY,
                    cz = z - chunkZ;
          bool isVisible = false;
          for (unsigned char face = 0; face < 6; face++) {
            const int nx = x + meshNormals[face][0].x,
                      ny = y + meshNormals[face][0].y,
                      nz = z + meshNormals[face][0].z,
                      neighbor = voxel(volume, nx, ny, nz);
            if (neighbor != -1 && !voxels[neighbor]) {
              isVisible = true;
              const float texture = mapping(face, value, x, y, z);
              faces[offset++] = cx + 0.5f;
              faces[offset++] = cy + 0.5f;
              faces[offset++] = cz + 0.5f;
              faces[offset++] = texture * 6.0f + (float) face;
              for (int channel = 0; channel < LIGHT_CHANNELS; channel++) {
                faces[offset++] = lighting(volume, voxels, light, face, channel, nx, ny, nz);
              }
              count++;
            }
          }
          if (isVisible) {
            if (box->min.x > cx) box->min.x = cx;
            if (box->min.y > cy) box->min.y = cy;
            if (box->min.z > cz) box->min.z = cz;
            if (box->max.x < cx + 1) box->max.x = cx + 1;
            if (box->max.y < cy + 1) box->max.y = cy + 1;
            if (box->max.z < cz + 1) box->max.z = cz + 1;
          }
        }
      }
    }
  }
  const float halfWidth = 0.5f * (box->max.x - box->min.x),
              halfHeight = 0.5f * (box->max.y - box->min.y),
              halfDepth = 0.5f * (box->max.z - box->min.z);
  sphere[0] = 0.5f * (box->min.x + box->max.x);
  sphere[1] = 0.5f * (box->min.y + box->max.y);
  sphere[2] = 0.5f * (box->min.z + box->max.z);
  sphere[3] = sqrt(
    halfWidth * halfWidth
    + halfHeight * halfHeight
    + halfDepth * halfDepth
  );
  return count;
}

const int pathfind(
  const Volume* volume,
  const unsigned char* voxels,
  const unsigned char* obstacles,
  int* results,
  const int height,
  const int maxVisited,
  const int minY,
  const int maxY,
  const int fromX,
  const int fromY,
  const int fromZ,
  const int toX,
  const int toY,
  const int toZ
) {
  if (
    fromX < 0 || fromX >= volume->width
    || fromY < 0 || fromY >= volume->height
    || fromZ < 0 || fromZ >= volume->depth
    || toX < 0 || toX >= volume->width
    || toY < 0 || toY >= volume->height
    || toZ < 0 || toZ >= volume->depth
  ) {
    return 0;
  }
  ASPath path = ASPathCreate(
    &PathNodeSource,
    &(PathContext){volume, voxels, obstacles, height, maxVisited, minY, maxY},
    &(Voxel){fromX, fromY, fromZ},
    &(Voxel){toX, toY, toZ}
  );
  const int nodes = ASPathGetCount(path);
  for (int i = 0, p = 0; i < nodes; i++, p += 3) {
    Voxel* node = ASPathGetNode(path, i);
    results[p] = node->x;
    results[p + 1] = node->y;
    results[p + 2] = node->z;
  }
  ASPathDestroy(path);
  return nodes;
}

int emission(int value);

void propagate(
  const Volume* volume,
  unsigned char* voxels,
  int* height,
  Light* light,
  int* queueA,
  int* queueB
) {
  for (int i = 0, z = 0; z < volume->depth; z++) {
    for (int x = 0; x < volume->width; x++, i++) {
      for (int y = volume->height - 1; y >= 0; y--) {
        if (y == 0 || voxels[voxel(volume, x, y, z)]) {
          height[i] = y;
          break;
        }
      }
    }
  }
  for (int channel = 0; channel < LIGHT_CHANNELS; channel++) {
    unsigned int count = 0;
    if (channel == LIGHT_CHANNEL_SUNLIGHT) {
      for (int z = 0; z < volume->depth; z++) {
        for (int x = 0; x < volume->width; x++) {
          const int i = voxel(volume, x, volume->height - 1, z);
          if (!voxels[i]) {
            light[i][channel] = volume->maxLight;
            queueA[count++] = i;
          }
        }
      }
    } else {
      for (int i = 0, z = 0; z < volume->depth; z++) {
        for (int y = 0; y < volume->height; y++) {
          for (int x = 0; x < volume->width; x++, i++) {
            if (voxels[i] && emission(voxels[i]) == channel) {
              light[i][channel] = volume->maxLight;
              queueA[count++] = i;
            }
          }
        }
      }
    }
    floodLight(
      NULL,
      channel,
      volume,
      voxels,
      height,
      light,
      queueA,
      count,
      queueB
    );
  }
}

void update(
  Box* bounds,
  const Volume* volume,
  unsigned char* voxels,
  int* height,
  Light* light,
  int* queueA,
  int* queueB,
  int* queueC,
  const int x,
  const int y,
  const int z,
  const unsigned char value,
  const unsigned char updateLight
) {
  bounds->min.x = bounds->max.x = x;
  bounds->min.y = bounds->max.y = y;
  bounds->min.z = bounds->max.z = z;

  const int i = voxel(volume, x, y, z);
  if (i == -1) {
    return;
  }
  const unsigned char current = voxels[i];
  if (current == value) {
    return;
  }
  voxels[i] = value;

  if (!updateLight) {
    return;
  }

  const int heightIndex = z * volume->width + x;
  const int currentHeight = height[heightIndex];
  if (value && currentHeight < y) {
    height[heightIndex] = y;
  }
  if (!value && currentHeight == y) {
    for (int h = y - 1; h >= 0; h--) {
      if (h == 0 || voxels[voxel(volume, x, h, z)]) {
        height[heightIndex] = h;
        break;
      }
    }
  }

  const int currentEmission = current ? emission(current) : 0;
  if (currentEmission > 0 && currentEmission < LIGHT_CHANNELS) {
    const unsigned char level = light[i][currentEmission];
    light[i][currentEmission] = 0;
    queueA[0] = i;
    queueA[1] = level;
    removeLight(
      bounds,
      currentEmission,
      volume,
      voxels,
      height,
      light,
      queueA,
      2,
      queueB,
      queueC,
      0
    );
  }

  if (value && !current) {
    for (int channel = 0; channel < LIGHT_CHANNELS; channel++) {
      const unsigned char level = light[i][channel];
      if (level != 0) {
        light[i][channel] = 0;
        queueA[0] = i;
        queueA[1] = level;
        removeLight(
          bounds,
          channel,
          volume,
          voxels,
          height,
          light,
          queueA,
          2,
          queueB,
          queueC,
          0
        );
      }
    }
  }

  const int valueEmission = value ? emission(value) : 0;
  if (valueEmission > 0 && valueEmission < LIGHT_CHANNELS) {
    light[i][valueEmission] = volume->maxLight;
    queueA[0] = i;
    floodLight(
      bounds,
      valueEmission,
      volume,
      voxels,
      height,
      light,
      queueA,
      1,
      queueB
    );
  }

  if (!value && current) {
    for (int channel = 0; channel < LIGHT_CHANNELS; channel++) {
      unsigned int count = 0;
      for (unsigned char n = 0; n < 6; n++) {
        const int neighbor = voxel(
          volume,
          x + lightNeighbors[n].x,
          y + lightNeighbors[n].y,
          z + lightNeighbors[n].z
        );
        if (neighbor != -1 && light[neighbor][channel]) {
          queueA[count++] = neighbor;
        }
      }
      if (count > 0) {
        floodLight(
          bounds,
          channel,
          volume,
          voxels,
          height,
          light,
          queueA,
          count,
          queueB
        );
      }
    }
  }
}
