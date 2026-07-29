const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const nwConfig = withNativeWind(config, { input: './src/global.css' });

// RxJS (used by WatermelonDB) ships CJS that references paths Metro can't resolve.
// Redirect all rxjs imports to the ESM build.
const originalResolveRequest = nwConfig.resolver.resolveRequest;

nwConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = originalResolveRequest || context.resolveRequest;

  if (moduleName === 'rxjs') {
    return resolve(context, 'rxjs/dist/esm/index.js', platform);
  }
  if (moduleName.startsWith('rxjs/')) {
    const sub = moduleName.replace('rxjs/', 'rxjs/dist/esm/');
    return resolve(context, sub, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = nwConfig;
