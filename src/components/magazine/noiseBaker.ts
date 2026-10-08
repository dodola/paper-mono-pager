import * as THREE from 'three';

export const SHEET_ASPECT = 1.377;
const NORMAL_EPSILON = 0.03;
const DEFORM_SCALE = 1.2;
const DEFORM_SEED = 46.0;

function fract(x: number): number {
  return x - Math.floor(x);
}

function hash(x: number, y: number): number {
  const dot = x * 127.1 + y * 311.7;
  return fract(Math.sin(dot) * 43758.5453);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(x: number, y: number, a: number): number {
  return x * (1 - a) + y * a;
}

function valueNoise(x: number, y: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const frX = fract(x);
  const frY = fract(y);
  const blendX = smoothstep(0, 1, frX);
  const blendY = smoothstep(0, 1, frY);

  const h00 = hash(cellX, cellY);
  const h10 = hash(cellX + 1, cellY);
  const h01 = hash(cellX, cellY + 1);
  const h11 = hash(cellX + 1, cellY + 1);

  const bot = mix(h00, h10, blendX);
  const top = mix(h01, h11, blendX);
  return mix(bot, top, blendY);
}

function fbmNoise(px: number, py: number): number {
  let value = 0.0;
  let amplitude = 0.5;
  let x = px;
  let y = py;
  for (let octave = 0; octave < 3; octave++) {
    value += amplitude * valueNoise(x, y);
    amplitude *= 0.5;
    x *= 2.0;
    y *= 2.0;
  }
  return value;
}

function rawNoise(uvX: number, uvY: number): number {
  const flatSheetX = uvX;
  const flatSheetY = (uvY - 0.5) * SHEET_ASPECT;
  const seedOffsetX = DEFORM_SEED * 13.37;
  const seedOffsetY = DEFORM_SEED * 7.77;
  return fbmNoise(
    flatSheetX / DEFORM_SCALE + seedOffsetX,
    flatSheetY / DEFORM_SCALE + seedOffsetY
  );
}

/**
 * Creates the sheet PlaneGeometry (width: 1, height: 1.377)
 * and bakes the exact analytical FBM noise vectors for base, dX, and dY into attribute `aNoise`.
 */
export function createBakedSheetGeometry(
  widthSegments = 64,
  heightSegments = 88
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, SHEET_ASPECT, widthSegments, heightSegments);
  
  // Note: PlaneGeometry default center is (0,0,0).
  // In the shader: flatSheetX = uv.x (0 to 1), flatSheetY = (uv.y - 0.5) * SHEET_ASPECT.
  // The shader expects uv from 0 to 1. PlaneGeometry generates uv in [0, 1].
  
  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const count = uvAttr.count;
  const aNoise = new Float32Array(count * 3);

  const duX = NORMAL_EPSILON;
  const duY = NORMAL_EPSILON / SHEET_ASPECT;

  for (let i = 0; i < count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);

    const n0 = rawNoise(u, v);
    const nX = rawNoise(u + duX, v);
    const nY = rawNoise(u, v + duY);

    aNoise[i * 3] = n0;
    aNoise[i * 3 + 1] = nX;
    aNoise[i * 3 + 2] = nY;
  }

  geometry.setAttribute('aNoise', new THREE.BufferAttribute(aNoise, 3));
  // Remove default normals as they will be dynamically computed in vertex shader
  geometry.deleteAttribute('normal');

  return geometry;
}
