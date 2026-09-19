import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button, FlatList } from 'react-native';
import { requestSMSPermissions } from './smsService';
import { parseBankSMS } from './parserEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const stored = await AsyncStorage.getItem('@expenses');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        setTransactions(parsed);
        calculateTotal(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const calculateTotal = (data) => {
    const total = data.reduce((sum, item) => sum + item.amount, 0);
    setTotalSpent(total);
  };

  const requestPerms = async () => {
    const granted = await requestSMSPermissions();
    setPermissionsGranted(granted);
  };

  const simulateIncomingSMS = async () => {
    // Since we cannot read real SMS on the local desktop environment easily,
    // we simulate an incoming SMS for testing the UI and Regex.
    const fakeSMS = "Dear SBI User, Rs.450.00 debited from A/c No. XX1111 on 19/09/26. Ref: UPI/123/Swiggy.";
    const parsedData = parseBankSMS(fakeSMS, "AD-SBIUPI");
    
    if (parsedData) {
      const newData = [parsedData, ...transactions];
      setTransactions(newData);
      calculateTotal(newData);
      await AsyncStorage.setItem('@expenses', JSON.stringify(newData));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Expense Tracker</Text>
      
      <View style={styles.dashboard}>
        <Text style={styles.dashboardLabel}>Total Spent (Simulated)</Text>
        <Text style={styles.dashboardTotal}>₹{totalSpent.toFixed(2)}</Text>
      </View>

      {!permissionsGranted ? (
        <Button title="Grant SMS Permissions" onPress={requestPerms} />
      ) : (
        <Text style={styles.successText}>SMS Permissions Granted!</Text>
      )}

      <Button title="Simulate Incoming SBI SMS" onPress={simulateIncomingSMS} color="#4CAF50" />

      <Text style={styles.listHeader}>Recent Transactions</Text>
      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.merchant}>{item.merchant}</Text>
              <Text style={styles.account}>{item.account}</Text>
            </View>
            <Text style={styles.amount}>- ₹{item.amount}</Text>
          </View>
        )}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  dashboard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  dashboardLabel: {
    fontSize: 16,
    color: '#666',
  },
  dashboardTotal: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e53935',
    marginTop: 8,
  },
  successText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 1,
  },
  merchant: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  account: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e53935',
  }
});
