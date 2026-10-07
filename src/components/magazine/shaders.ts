export const SHEET_CONSTANTS = /* glsl */ `
    const float SHEET_ASPECT         = 1.377;
    const float NORMAL_EPSILON     = 0.03;

    const float LIFT_MAX_X         = 0.14;
    const float LIFT_MAX_Z         = 0.04;
    const float LIFT_DIP_X         = 0.58;
    const float LIFT_DIP_Z         = 0.035;
    const float LIFT_MID_X         = 0.72;
    const float LIFT_MID_Z         = 0.04;
    const float LIFT_EDGE_Z        = 0.03;

    const float DEFORM             = 0.13;
    const float DEFORM_SCALE       = 1.2;
    const float DEFORM_SEED        = 46.0;

    const float PATTERN_SIZE       = 1.46;
    const float TEXTURE_COLOR      = 0.17;
    const float PATTERN_ROUGHNESS  = 0.33;
    const float PAPER_TRANSPARENCY = 0.04;
    const float INK_GLOSS          = 0.33;
    const float SHADOW_OFFSET_X    = 0.004;
`;

export const VERTEX_DECLARATIONS = /* glsl */ `
    ${SHEET_CONSTANTS}

    uniform float uFlipProgress;
    uniform float uWrinkleSide;
    uniform float uBendAngle;
    uniform vec2 uFold;
    uniform vec2 uCurl;
    uniform vec2 uFlipRotation;
    uniform float uDirection;
    uniform float uStackLift;
    uniform sampler2D uBackMap;
    varying vec2 vGrainUv;

    attribute vec3 aNoise;

    const float PI      = 3.14159265;
    const float HALF_PI = 1.57079633;

    vec3 _computeSheetPosition(vec2 uv, float rawNoise) {
        float flatSheetX = uv.x;
        float flatSheetY = (uv.y - 0.5) * SHEET_ASPECT;

        float wrinkle = mix(rawNoise, 1.0 - rawNoise, uFlipProgress) - .5;
        wrinkle *= smoothstep(0.0, 0.35, uv.x);
        wrinkle *= DEFORM;
        wrinkle *= uStackLift;

        float restingLift;
        if (uv.x <= LIFT_MAX_X) {
            restingLift = LIFT_MAX_Z * sin(uv.x / LIFT_MAX_X * HALF_PI);
        } else if (uv.x <= LIFT_DIP_X) {
            restingLift = mix(LIFT_MAX_Z, LIFT_DIP_Z, smoothstep(LIFT_MAX_X, LIFT_DIP_X, uv.x));
        } else if (uv.x <= LIFT_MID_X) {
            restingLift = mix(LIFT_DIP_Z, LIFT_MID_Z, smoothstep(LIFT_DIP_X, LIFT_MID_X, uv.x));
        } else {
            float t = (uv.x - LIFT_MID_X) / (1.0 - LIFT_MID_X);
            float edgeLift = LIFT_EDGE_Z;
            restingLift = mix(LIFT_MID_Z, edgeLift, 1.0 - cos(t * HALF_PI));
        }
        restingLift *= uStackLift;

        float cosFold = uFold.x;
        float sinFold = uFold.y;
        float localU =  flatSheetX * cosFold + flatSheetY * sinFold;
        float localV = -flatSheetX * sinFold + flatSheetY * cosFold;

        float curlStart  = uCurl.x;
        float curlLength = uCurl.y;

        float beyondCurl = max(0.0, localU - curlStart);
        float curlNorm   = beyondCurl / curlLength;

        float cylinderAngle  = curlNorm * uBendAngle;
        float sinc    = abs(cylinderAngle) < 1e-4 ? 1.0 : sin(cylinderAngle) / cylinderAngle;
        float versine = abs(cylinderAngle) < 1e-4 ? 0.0 : (1.0 - cos(cylinderAngle)) / cylinderAngle;
        float curvedLocal    = beyondCurl * sinc;
        float curvedZ        = -uDirection * beyondCurl * versine;
        float curledU        = localU - beyondCurl + curvedLocal;

        float px = curledU * cosFold - localV * sinFold;
        float py = curledU * sinFold + localV * cosFold;
        float pz = curvedZ;

        float cosRot = uFlipRotation.x;
        float sinRot = uFlipRotation.y;

        float x = px * cosRot - pz * sinRot;
        float y = py;
        float z = px * sinRot + pz * cosRot;

        z += restingLift;
        vec3 p = vec3(x, y, z);

        p.z += uWrinkleSide * wrinkle;

        return p;
    }

    vec3 _transformedSheetPosition;
`;

export const NORMAL_RECOMPUTE = /* glsl */ `
    float epsilon = NORMAL_EPSILON;
    vec2 du = vec2(epsilon, epsilon / SHEET_ASPECT);

    vec3 sheetP  = _computeSheetPosition(uv,                       aNoise.x);
    vec3 sheetPx = _computeSheetPosition(uv + vec2(du.x, 0.0),      aNoise.y);
    vec3 sheetPy = _computeSheetPosition(uv + vec2(0.0, du.y),      aNoise.z);

    vec3 surfaceNormal = normalize(cross(sheetPx - sheetP, sheetPy - sheetP));

    _transformedSheetPosition = sheetP;
`;

export const DEPTH_VERTEX_POSITION = /* glsl */ `
    _transformedSheetPosition = _computeSheetPosition(uv, aNoise.x);
`;

export const FRAGMENT_HEADER = /* glsl */ `
    ${SHEET_CONSTANTS}
    uniform sampler2D uBackMap;
    uniform sampler2D uPatternTex;
    varying vec2 vGrainUv;
`;

export const MAP_FRAGMENT = /* glsl */ `
    float inkAmount = 0.0;
    #ifdef USE_MAP
        vec2 flippedUv = vec2(1.0 - vMapUv.x, vMapUv.y);
        vec4 frontColor = texture2D(map, vMapUv);
        vec4 backColor  = texture2D(uBackMap, flippedUv);
        vec4 faceColor  = gl_FrontFacing ? frontColor : backColor;
        vec4 otherColor = gl_FrontFacing ? backColor  : frontColor;
        vec4 sheetColor = faceColor;
        sheetColor.rgb *= mix(vec3(1.0), otherColor.rgb, PAPER_TRANSPARENCY);
        diffuseColor *= sheetColor;
        inkAmount = 1.0 - dot(faceColor.rgb, vec3(0.299, 0.587, 0.114));
    #endif
`;

export const ROUGHNESS_FRAGMENT = /* glsl */ `
    #include <roughnessmap_fragment>
    roughnessFactor *= mix(1., 0., inkAmount * INK_GLOSS);
    float pattern = texture2D(uPatternTex, vGrainUv * PATTERN_SIZE * vec2(1.0, SHEET_ASPECT)).r;
    pattern = 2. * pow(pattern, 7.);
    roughnessFactor = clamp(mix(roughnessFactor, 1.0, clamp(pattern * PATTERN_ROUGHNESS, 0.0, 1.0)), 0.0, 1.0);
`;

export const OPAQUE_FRAGMENT = /* glsl */ `
    #include <opaque_fragment>
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.), pattern * TEXTURE_COLOR);
`;

export const NORMAL_FRAGMENT = /* glsl */ `
    vec3 normal = normalize(vNormal);
    float faceDirection = normal.z >= 0.0 ? 1.0 : -1.0;
    normal *= faceDirection;
    vec3 nonPerturbedNormal = normal;
`;
