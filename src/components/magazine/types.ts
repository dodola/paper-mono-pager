import * as THREE from 'three';

export interface CurveParams {
  curlArc: number;
  curlAngleDeg: number;
}

export interface WobbleState {
  arc: number;
  angle: number;
  tilt: number;
}

export interface SheetUniforms {
  uDirection: { value: number };
  uStackLift: { value: number };
  uFlipProgress: { value: number };
  uWrinkleSide: { value: number };
  uBendAngle: { value: number };
  uFold: { value: THREE.Vector2 };
  uCurl: { value: THREE.Vector2 };
  uFlipRotation: { value: THREE.Vector2 };
  uPatternTex: { value: THREE.Texture };
  uBackMap: { value: THREE.Texture };
}

export interface SheetData {
  mesh: THREE.Mesh;
  sheetUniforms: SheetUniforms;
  frontTex: THREE.Texture;
  flipProgress: number;
  direction: number;
  directionSmooth: number;
  curve: CurveParams;
  curveTarget: CurveParams;
  wobble: WobbleState;
  stackLiftBase: number;
  stackLiftSpan: number;
}

export interface ActiveAnimation {
  sheetIndex: number;
  fromProgress: number;
  toProgress: number;
  direction: number;
  startTime: number;
  duration: number;
  launch?: number;
}

export interface DragState {
  sheetIndex: number;
  forward: boolean;
  base: number;
  progress: number;
  rectWidth: number;
  targetCurve: CurveParams;
  speed: number;
}

export interface AutoFlipState {
  forward: boolean;
  x: number;
  y: number;
  count: number;
  fired: boolean;
  timer: any;
}

export interface MagazinePageInfo {
  side: number;
  url: string;
}
