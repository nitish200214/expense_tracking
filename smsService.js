import * as SMS from 'expo-sms';
import { PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const requestSMSPermissions = async () => {
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);

    return (
      granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (err) {
    console.warn(err);
    return false;
  }
};

export const fetchSMS = async () => {
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) {
    return [];
  }

  // NOTE: expo-sms does not natively support reading inbox without native modules/ejecting.
  // We will need a specific React Native module that allows inbox reading like 'react-native-android-sms-listener' 
  // or similar native code since expo-sms is mostly for composing. 
  // For Cloud builds we will use react-native-android-sms-listener (which we installed).
  
  // Since we cannot run it on emulator easily without native build, this is the placeholder.
  console.log("SMS Permission Granted, ready to read.");
  return [];
};
