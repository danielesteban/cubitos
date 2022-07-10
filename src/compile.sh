#!/bin/sh
cd "${0%/*}"

clang --target=wasm32-unknown-wasi --sysroot=../vendor/wasi-libc/sysroot -nostartfiles -flto -Ofast \
-Wl,--import-memory -Wl,--import-undefined -Wl,--no-entry -Wl,--lto-O3 \
-Wl,--export=malloc \
-Wl,--export=ground \
-Wl,--export=mesh \
-Wl,--export=pathfind \
-Wl,--export=propagate \
-Wl,--export=update \
-Wl,--export=voxel \
-o ./volume.wasm ./volume.c

clang --target=wasm32-unknown-wasi --sysroot=../vendor/wasi-libc/sysroot -nostartfiles -flto -Ofast \
-Wl,--import-memory -Wl,--no-entry -Wl,--lto-O3 \
-Wl,--export=malloc \
-Wl,--export=generate \
-o ./worldgen.wasm ./worldgen.c
