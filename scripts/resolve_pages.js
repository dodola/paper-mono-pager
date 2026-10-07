const fs = require('fs');

const f1 = fs.readFileSync('temp_chunks/1i4-vcdxd9wyu.js', 'utf-8');
const c30376 = fs.readFileSync('clean_30376.js', 'utf-8');

// Match modules in 1i4
const modToImg = {};
const re = /(\d+),e=>\{e\.q\("([^"]+)"\)\}/g;
let m;
while ((m = re.exec(f1)) !== null) {
  modToImg[m[1]] = m[2];
}

console.log('Modules mapped to images:', Object.keys(modToImg).length);

// In clean_30376.js, let's see how each variable maps to module ID:
// o = { src: e.i(60701).default ... }
// l = { src: e.i(5001).default ... }
// etc.
const varToMod = {};
const varRe = /let ([a-zA-Z0-9_$]+)\s*=\s*\{\s*src:\s*e\.i\((\d+)\)/g;
while ((m = varRe.exec(c30376)) !== null) {
  varToMod[m[1]] = m[2];
}

console.log('Variables mapped to module IDs:', Object.keys(varToMod).length);

// Also N = { "01": [s(o)], "02": [s(l)], ... }
const nStart = c30376.indexOf('N = {');
const nEnd = c30376.indexOf('};', nStart);
const nContent = c30376.slice(nStart, nEnd + 2);

console.log('N content:\n', nContent);
