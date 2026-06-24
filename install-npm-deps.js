const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nodeModulesDir = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesDir)) {
  fs.mkdirSync(nodeModulesDir);
}

const packages = [
  {
    name: 'xlsx',
    url: 'https://registry.npmjs.org/xlsx/-/xlsx-0.18.5.tgz'
  },
  {
    name: 'node-firebird',
    url: 'https://registry.npmjs.org/node-firebird/-/node-firebird-0.8.9.tgz'
  },
  {
    name: 'long',
    url: 'https://registry.npmjs.org/long/-/long-2.2.5.tgz'
  },
  {
    name: 'pdf-parse',
    url: 'https://registry.npmjs.org/pdf-parse/-/pdf-parse-1.1.1.tgz'
  },
  {
    name: 'node-ensure',
    url: 'https://registry.npmjs.org/node-ensure/-/node-ensure-0.0.0.tgz'
  },
  {
    name: 'debug',
    url: 'https://registry.npmjs.org/debug/-/debug-3.2.7.tgz'
  },
  {
    name: 'ms',
    url: 'https://registry.npmjs.org/ms/-/ms-2.1.3.tgz'
  }
];

async function downloadAndExtract(pkg) {
  const tgzPath = path.join(__dirname, `${pkg.name}.tgz`);
  console.log(`Downloading ${pkg.name} from ${pkg.url}...`);
  
  const response = await fetch(pkg.url);
  if (!response.ok) {
    throw new Error(`Failed to download ${pkg.name}: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(tgzPath, Buffer.from(arrayBuffer));
  console.log(`Downloaded ${pkg.name}.tgz`);

  const destDir = path.join(nodeModulesDir, pkg.name);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir);

  // Extract using Windows built-in tar.exe
  console.log(`Extracting ${pkg.name}.tgz...`);
  const tempExtractDir = path.join(__dirname, `temp_${pkg.name}`);
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempExtractDir);

  try {
    execSync(`tar -xzf "${tgzPath}" -C "${tempExtractDir}"`);
    // tar puts contents inside a "package" directory
    const packageDir = path.join(tempExtractDir, 'package');
    if (fs.existsSync(packageDir)) {
      // Copy files to target node_modules/name
      fs.cpSync(packageDir, destDir, { recursive: true });
      console.log(`Successfully installed ${pkg.name}`);
    } else {
      console.error(`Error: 'package' folder not found inside tarball of ${pkg.name}`);
    }
  } catch (err) {
    console.error(`Failed to extract ${pkg.name}:`, err.message);
  } finally {
    // Cleanup temp files
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    fs.rmSync(tgzPath, { force: true });
  }
}

async function run() {
  for (const pkg of packages) {
    await downloadAndExtract(pkg);
  }
  console.log('All dependencies installed successfully!');
}

run().catch(console.error);
