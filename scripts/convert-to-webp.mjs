import sharp from 'sharp';
import { readdir, unlink } from 'fs/promises';
import { join, extname, basename } from 'path';

import { resolve } from 'path';
const assetsDir = resolve(process.cwd(), 'src/assets');

const files = await readdir(assetsDir);
const jpgs = files.filter(f => extname(f).toLowerCase() === '.jpg');

for (const file of jpgs) {
  const input = join(assetsDir, file);
  const output = join(assetsDir, basename(file, '.jpg') + '.webp');
  await sharp(input).webp({ quality: 82 }).toFile(output);
  await unlink(input);
  console.log(`✓ ${file} → ${basename(file, '.jpg')}.webp`);
}

console.log(`\nDone. Converted ${jpgs.length} files.`);
