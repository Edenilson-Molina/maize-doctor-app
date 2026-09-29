const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('tflite');
config.resolver.unstable_enablePackageExports = false;

const nwConfig = withNativeWind(config, { input: './src/global.css' });
nwConfig.resolver.unstable_enablePackageExports = false;

// Font packages that ship every weight/style as a static top-level require().
// Metro bundles all of them regardless of which named exports are actually
// imported, so unused weights still end up in the native APK as res/raw
// assets. Redirect to shims that only require() the weights we use.
const FONT_SHIMS = {
  '@expo-google-fonts/hanken-grotesk': './src/fonts/hankenGroteskShim.ts',
  '@expo-google-fonts/inter': './src/fonts/interShim.ts',
  '@expo-google-fonts/jetbrains-mono': './src/fonts/jetbrainsMonoShim.ts',
  '@expo/vector-icons': './src/fonts/vectorIconsShim.ts',
};

// RxJS (used by WatermelonDB) ships CJS that references paths Metro can't resolve.
// Redirect all rxjs imports to the ESM build.
const originalResolveRequest = nwConfig.resolver.resolveRequest;

nwConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = originalResolveRequest || context.resolveRequest;

  if (moduleName in FONT_SHIMS) {
    return resolve(context, path.resolve(__dirname, FONT_SHIMS[moduleName]), platform);
  }
  if (moduleName === 'rxjs') {
    return resolve(context, path.resolve(__dirname, 'node_modules/rxjs/dist/esm5/index.js'), platform);
  }
  if (moduleName === 'rxjs/operators') {
    return resolve(context, path.resolve(__dirname, 'node_modules/rxjs/dist/esm5/operators/index.js'), platform);
  }
  if (moduleName.startsWith('rxjs/')) {
    const sub = moduleName.replace('rxjs/', '');
    const fs = require('fs');
    const candidateIndex = path.resolve(__dirname, `node_modules/rxjs/dist/esm5/${sub}/index.js`);
    const candidateDirect = path.resolve(__dirname, `node_modules/rxjs/dist/esm5/${sub}.js`);
    if (fs.existsSync(candidateIndex)) return resolve(context, candidateIndex, platform);
    if (fs.existsSync(candidateDirect)) return resolve(context, candidateDirect, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = nwConfig;
