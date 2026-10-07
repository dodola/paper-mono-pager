const https = require('https');
const fs = require('fs');
const path = require('path');

const pageMap = JSON.parse(fs.readFileSync('scripts/page_sides_map.json', 'utf-8'));
const outDir = path.join(__dirname, '..', 'public', 'assets', 'pages');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Status ${res.statusCode} for ${url}`));
      }
      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        resolve(fs.statSync(dest).size);
      });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  // Download texture first
  const texUrl = 'https://paper.design/mono/_next/static/media/monoMagazineTexture.2alrgz5ynltjb.webp';
  const texDest = path.join(outDir, 'texture.webp');
  console.log('Downloading texture...');
  await download(texUrl, texDest);
  console.log('Texture downloaded:', fs.statSync(texDest).size, 'bytes');

  // Download 28 pages at w=1920 for maximum sharpness and reasonable size
  console.log('Downloading 28 pages...');
  for (const item of pageMap) {
    const encoded = encodeURIComponent(item.url);
    const pageUrl = `https://paper.design/mono/_next/image?url=${encoded}&w=1920&q=90`;
    const sideName = `page_${item.side.toString().padStart(2, '0')}.png`;
    const dest = path.join(outDir, sideName);
    const size = await download(pageUrl, dest);
    console.log(`Downloaded ${sideName}: ${(size / 1024).toFixed(1)} KB`);
  }
  console.log('All downloads complete!');
})();
