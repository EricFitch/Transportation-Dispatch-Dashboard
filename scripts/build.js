import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Simple build script for bundling JS and copying static assets into dist/
// - Bundles src/app.js into dist/js/app.js (format:esm)
// - Copies static files from root (index.html, sw.js, staff-details.html, fleet-details.html) and assets/

const outDir = './dist';

function ensure(dir) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {}
}

async function bundle() {
  ensure(outDir);
  ensure(`${outDir}/js`);
  ensure(`${outDir}/css`);

  console.log('Bundling JS with esbuild...');
  await build({
    entryPoints: ['src/app.js'],
    bundle: true,
    format: 'esm',
    outfile: `${outDir}/js/app.js`,
    minify: true,
    sourcemap: false,
  });

  console.log('Copying static files...');
  const staticFiles = ['index.html', 'sw.js', 'staff-details.html', 'fleet-details.html'];
  for (const f of staticFiles) {
    try {
      cpSync(f, `${outDir}/${f}`, { recursive: true });
    } catch (e) {
      // ignore missing files
    }
  }

  console.log('Copying assets...');
  try {
    cpSync('assets', `${outDir}/assets`, { recursive: true });
  } catch (e) {
    // ignore
  }

  console.log('Build complete. Run `npm run build:css` to compile Tailwind CSS.');
}

bundle().catch((err) => {
  console.error(err);
  process.exit(1);
});
