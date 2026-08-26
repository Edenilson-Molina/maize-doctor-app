const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const LOADER = `
def maizeKeystoreFile = rootProject.file('keystore.properties')
def maizeKeystore = new Properties()
if (maizeKeystoreFile.exists()) {
    maizeKeystoreFile.withInputStream { maizeKeystore.load(it) }
}
`;

const SIGNING_CONFIG = `        release {
            if (maizeKeystore['MAIZE_STORE_FILE']) {
                storeFile file(maizeKeystore['MAIZE_STORE_FILE'])
                storePassword maizeKeystore['MAIZE_STORE_PASSWORD']
                keyAlias maizeKeystore['MAIZE_KEY_ALIAS']
                keyPassword maizeKeystore['MAIZE_KEY_PASSWORD']
            }
        }
`;

/**
 * Restricts the packaged ABIs to the two ARM variants real devices use.
 *
 * The x86/x86_64 slices only serve emulators and roughly double the APK, since
 * every native dependency ships one copy per ABI.
 *
 * @param {import('expo/config').ExpoConfig} config Expo config being modified.
 * @returns {import('expo/config').ExpoConfig} Config with the ABI list narrowed.
 */
function withArmOnlyAbis(config) {
  return withGradleProperties(config, (cfg) => {
    const entry = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    );
    if (entry) {
      entry.value = 'armeabi-v7a,arm64-v8a';
    } else {
      cfg.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: 'armeabi-v7a,arm64-v8a',
      });
    }
    return cfg;
  });
}

/**
 * Adds a `release` signing config backed by `android/keystore.properties`.
 *
 * The file is untracked, so a checkout without it still builds: the release
 * build type falls back to the debug keystore instead of failing.
 *
 * @param {import('expo/config').ExpoConfig} config Expo config being modified.
 * @returns {import('expo/config').ExpoConfig} Config with the signing patch applied.
 */
function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (!gradle.includes('maizeKeystoreFile')) {
      gradle = gradle.replace(/(apply plugin: "com\.facebook\.react"\n)/, `$1${LOADER}`);
    }

    if (!gradle.includes('MAIZE_STORE_FILE')) {
      gradle = gradle.replace(/(signingConfigs \{\n)/, `$1${SIGNING_CONFIG}`);
    }

    gradle = gradle.replace(
      /(release \{\n(?:\s*\/\/[^\n]*\n)*)\s*signingConfig signingConfigs\.debug/,
      `$1            signingConfig maizeKeystore['MAIZE_STORE_FILE'] ? signingConfigs.release : signingConfigs.debug`
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
}

module.exports = (config) => withArmOnlyAbis(withReleaseSigning(config));
