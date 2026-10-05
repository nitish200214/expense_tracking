const { withAndroidManifest } = require('@expo/config-plugins');

const withCustomManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Ensure application exists
    if (!androidManifest.application) return config;
    const application = androidManifest.application[0];

    // Ensure tools namespace exists
    if (!androidManifest.$['xmlns:tools']) {
      androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Fix Manifest Merger error for allowBackup (required by react-native-android-notification-listener)
    if (!application.$['tools:replace']) {
      application.$['tools:replace'] = 'android:allowBackup';
    } else if (!application.$['tools:replace'].includes('android:allowBackup')) {
      application.$['tools:replace'] += ',android:allowBackup';
    }

    // Add SMS permissions if not handled by expo-sms
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    
    const requiredPermissions = [
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS'
    ];

    requiredPermissions.forEach((perm) => {
      const hasPerm = androidManifest['uses-permission'].some(
        (p) => p.$['android:name'] === perm
      );
      if (!hasPerm) {
        androidManifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    });

    return config;
  });
};

module.exports = ({ config }) => {
  return withCustomManifest(config);
};
