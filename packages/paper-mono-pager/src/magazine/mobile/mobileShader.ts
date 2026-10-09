/**
 * 移动端单页堆叠杂志的着色器片段。
 * 顶点形变分四层（由内到外）：堆叠抬升 → 尾部弯曲 → 锥形卷起 → 绕书脊旋转。
 */

export const MOBILE_SHEET_CONSTANTS = /* glsl */ `
    const float SHEET_ASPECT         = 1.377;
    const float NORMAL_EPSILON       = 0.02;

    const float PATTERN_SIZE         = 1.46;
    const float TEXTURE_COLOR        = 0.17;
    const float PATTERN_ROUGHNESS    = 0.33;
    const float PAPER_TRANSPARENCY   = 0.3;
    const float INK_GLOSS            = 0.33;
    const float SHADOW_OFFSET_X      = -0.004;
`;

/** 阴影强度（由 DirectionalLight.shadow.intensity 承担，不在着色器里改） */
export const MOBILE_SHADOW_INTENSITY = 0.4;

export const MOBILE_VERTEX_DECLARATIONS = /* glsl */ `
    ${MOBILE_SHEET_CONSTANTS}

    uniform vec3  uPileLift;     // x: 抬升峰值位置  y: 抬升高度  z: 外缘回落比例
    uniform float uConeTaper;    // 抬升随纵向的锥度
    uniform vec2  uPileReach;    // 纸面上下两端沿 x 的伸展补偿
    uniform vec4  uTailCurl;     // xy: 弯曲轴方向  z: 弯曲起点  w: 弯曲段长度
    uniform float uTailBend;     // 尾部弯曲角
    uniform vec3  uCone;         // x: 锥度  y: 顶部半径  z: 最大卷绕角
    uniform vec2  uFlipRotation; // 绕书脊旋转 (cos, sin)
    varying vec2  vGrainUv;

    // 纸张静置时离桌面的弧形隆起
    float _restLift(float x) {
        float liftT = 1.0 - min(x / uPileLift.x, 1.0);
        float fall = uPileLift.z * smoothstep(uPileLift.x, 1.0, x);
        return uPileLift.y * sqrt(1.0 - liftT * liftT) * (1.0 - fall);
    }

    // 把平面纸卷到锥面上：spread 为锥度，topR 为顶部半径，maxWrap 为最大卷绕角
    vec3 _coneWrap(float flatSheetX, float flatSheetY, float spread, float topR, float maxWrap) {
        float apexY   = SHEET_ASPECT * 0.5;
        float rowR    = max(1e-5, topR + (apexY - flatSheetY) * spread);
        float cosCone = sqrt(max(0.0, 1.0 - spread * spread));
        float slant   = flatSheetX * spread / rowR;
        float lean    = abs(slant) < 1e-3 ? 1.0 - slant * slant / 3.0 : atan(slant) / slant;
        float wrap    = (flatSheetX / rowR) * lean;
        vec3 rolledAt;
        if (wrap <= maxWrap) {
            float reachR = length(vec2(rowR, flatSheetX * spread));
            rolledAt = vec3(
                reachR * sin(wrap),
                flatSheetY + spread * (reachR * (1.0 - cos(wrap)) - flatSheetX * flatSheetX / (rowR + reachR)),
                reachR * cosCone * (1.0 - cos(wrap))
            );
        } else {
            // 超过最大卷绕角的部分沿切线直线伸出
            float capFan  = spread * maxWrap;
            float capSin  = abs(capFan) < 1e-3 ? 1.0 - capFan * capFan / 6.0 : sin(capFan) / capFan;
            float capVers = abs(capFan) < 1e-3 ? capFan * (0.5 - capFan * capFan / 24.0) : (1.0 - cos(capFan)) / capFan;
            float along   = flatSheetX * spread * sin(capFan) + rowR * cos(capFan);
            float past    = flatSheetX * cos(capFan) - rowR * maxWrap * capSin;
            float lift    = along * (1.0 - cos(maxWrap)) + past * sin(maxWrap);
            rolledAt = vec3(
                along * sin(maxWrap) + past * cos(maxWrap),
                flatSheetY + rowR * maxWrap * capVers - flatSheetX * sin(capFan) + spread * lift,
                cosCone * lift
            );
        }
        return rolledAt;
    }

    vec3 _sheetShape(float flatSheetX, float flatSheetY) {
        return _coneWrap(flatSheetX, flatSheetY, uCone.x, uCone.y, uCone.z);
    }

    vec3 _pileShape(float u, float t) {
        float row   = t / SHEET_ASPECT;
        float taper = 1.0 + uConeTaper * row;
        float x     = u * mix(uPileReach.x, uPileReach.y, row + 0.5);
        return vec3(x, t, _restLift(x) * taper);
    }

    // 卷在卷筒上的部分之外，自由端向后弯
    vec3 _tailCurl(vec2 p) {
        float cosTilt = uTailCurl.x;
        float sinTilt = uTailCurl.y;
        float along  = p.x * cosTilt + p.y * sinTilt;
        float across = -p.x * sinTilt + p.y * cosTilt;
        float beyond = max(0.0, along - uTailCurl.z);
        float angle  = beyond / uTailCurl.w * uTailBend;
        float sinc    = abs(angle) < 1e-4 ? 1.0 : sin(angle) / angle;
        float versine = abs(angle) < 1e-4 ? 0.0 : (1.0 - cos(angle)) / angle;
        float curledAlong = along - beyond + beyond * sinc;
        return vec3(
            curledAlong * cosTilt - across * sinTilt,
            curledAlong * sinTilt + across * cosTilt,
            beyond * versine
        );
    }

    vec3 _spunAboutSpine(vec3 shape, float pileLift) {
        float px = shape.x;
        float py = shape.y;
        float pz = shape.z + pileLift;
        float cosRot = uFlipRotation.x;
        float sinRot = uFlipRotation.y;
        return vec3(px * cosRot - pz * sinRot, py, px * sinRot + pz * cosRot);
    }

    vec3 _computeSheetPosition(vec2 uv) {
        vec3 pile = _pileShape(uv.x, (uv.y - 0.5) * SHEET_ASPECT);
        vec3 curled = _tailCurl(pile.xy);
        vec3 shape = _sheetShape(curled.x, curled.y);
        if (curled.z != 0.0) {
            vec3 alongX = _sheetShape(curled.x + 1e-3, curled.y) - shape;
            vec3 alongY = _sheetShape(curled.x, curled.y + 1e-3) - shape;
            shape += normalize(cross(alongX, alongY)) * curled.z;
        }
        return _spunAboutSpine(shape, pile.z);
    }

    vec3 _transformedSheetPosition;
`;

export const MOBILE_NORMAL_RECOMPUTE = /* glsl */ `
    float epsilon = NORMAL_EPSILON;
    vec2 du = vec2(epsilon, epsilon / SHEET_ASPECT);

    vec3 sheetP  = _computeSheetPosition(uv);
    vec3 sheetPx = _computeSheetPosition(uv + vec2(du.x, 0.0));
    vec3 sheetPy = _computeSheetPosition(uv + vec2(0.0, du.y));

    vec3 surfaceNormal = normalize(cross(sheetPx - sheetP, sheetPy - sheetP));

    _transformedSheetPosition = sheetP;
`;

export const MOBILE_DEPTH_VERTEX_POSITION = /* glsl */ `
    _transformedSheetPosition = _computeSheetPosition(uv);
`;

export const MOBILE_FRAGMENT_HEADER = /* glsl */ `
    ${MOBILE_SHEET_CONSTANTS}
    uniform sampler2D uBackMap;
    uniform sampler2D uPatternTex;
    varying vec2 vGrainUv;
`;
