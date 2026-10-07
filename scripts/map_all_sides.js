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

const vars = ['o', 'l', 'h', 'c', 'u', 'd', 'p', 'f', 'm', 'g', '_', 'v', 'x', 'M', 'y', 'S', 'E', 'A', 'T', 'b', 'w', 'R', 'C', 'L', 'P', 'U', 'D', 'I'];

const varMap = {};
for (const v of vars) {
  // search for "v = { src: e.i(12345)" or ", v = { src: e.i(12345)"
  const reg = new RegExp('(?:let|,)\\s*' + v.replace('_', '\\_') + '\\s*=\\s*\\{\\s*src:\\s*e\\.i\\((\\d+)\\)');
  const match = c30376.match(reg);
  if (match) {
    const modId = match[1];
    varMap[v] = { modId, url: modToImg[modId] };
  } else {
    console.log('Not found for var:', v);
  }
}

console.log('Mapped variables:');
const pageSides = [
  'o', 'l', 'h', 'c', 'u', 'd', 'p', 'f', 'm', 'g', '_', 'v', 'x',
  'M', 'y', 'S', 'E',
  'A', 'T', 'b', 'w', 'R', 'C', 'L', 'P', 'U', 'D', 'I'
];

const sideList = [];
pageSides.forEach((v, idx) => {
  const sideNum = idx + 1;
  const info = varMap[v];
  console.log(`Side ${sideNum.toString().padStart(2, '0')} (${v}): ${info?.url}`);
  sideList.push({ side: sideNum, var: v, modId: info?.modId, url: info?.url });
});

fs.writeFileSync('scripts/page_sides_map.json', JSON.stringify(sideList, null, 2));
