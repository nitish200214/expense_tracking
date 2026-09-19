import { PermissionsAndroid } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { processIncomingAlert } from './TransactionManager';

export const requestAllPermissions = async () => {
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
    ]);
    
    return granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
           granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

export const scanPastSMS = async () => {
  const hasPermission = await requestAllPermissions();
  if (!hasPermission) return 0;

  const filter = {
    box: 'inbox',
    maxCount: 200, // Read the last 200 messages for speed
  };

  return new Promise((resolve, reject) => {
    SmsAndroid.list(
      JSON.stringify(filter),
      (fail) => {
        console.log('Failed to read SMS: ' + fail);
        resolve(0);
      },
      async (count, smsList) => {
        const messages = JSON.parse(smsList);
        let newExpensesFound = 0;
        
        // Process oldest to newest so they sort correctly
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          const success = await processIncomingAlert(msg.body, msg.address, msg.date);
          if (success) newExpensesFound++;
        }
        
        console.log(`Scanned ${count} messages, found ${newExpensesFound} new expenses.`);
        resolve(newExpensesFound);
      }
    );
  });
};
