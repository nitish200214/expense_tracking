import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button, SectionList, Alert, TouchableOpacity } from 'react-native';
import { requestAllPermissions, scanPastSMS } from '../services/smsScanner';
import { loadTransactions, saveTransactions, processIncomingAlert } from '../services/TransactionManager';
import { generatePDF } from '../services/pdfGenerator';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export default function Index() {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [groupedTransactions, setGroupedTransactions] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    refreshData();
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    const status = await RNAndroidNotificationListener.getPermissionStatus();
    if (status !== 'authorized') {
      Alert.alert(
        'Enable Notifications',
        'To track GPay/PhonePe instantly, please allow Notification Access in the next screen.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => RNAndroidNotificationListener.requestPermission() }
        ]
      );
    }
  };

  const refreshData = async () => {
    const txs = await loadTransactions();
    
    // Calculate total
    const total = txs.reduce((sum, item) => sum + item.amount, 0);
    setTotalSpent(total);

    // Group by month (e.g. "September 2026")
    const groups = txs.reduce((acc, tx) => {
      const monthYear = format(new Date(tx.date), 'MMMM yyyy');
      if (!acc[monthYear]) acc[monthYear] = [];
      acc[monthYear].push(tx);
      return acc;
    }, {});

    const sectionListData = Object.keys(groups).map(title => ({
      title,
      data: groups[title]
    }));

    setGroupedTransactions(sectionListData);
  };

  const handleRequestPerms = async () => {
    const granted = await requestAllPermissions();
    setPermissionsGranted(granted);
    if (granted) {
      await scanPastSMS();
      refreshData();
    }
  };

  const simulateGPay = async () => {
    const fakeNotif = "Paid ₹850 to Swiggy Delivery";
    await processIncomingAlert(fakeNotif, "NOTIFICATION", new Date().toISOString());
    refreshData();
  };

  const manualEntry = async () => {
    const newTx = {
      id: uuidv4(),
      amount: 150,
      merchant: "Cash Expense (Manual)",
      account: "Cash",
      date: new Date().toISOString()
    };
    const current = await loadTransactions();
    await saveTransactions([newTx, ...current]);
    refreshData();
  };

  const deleteExpense = (id) => {
    Alert.alert(
      "Delete Expense?",
      "Are you sure you want to delete this expense? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const current = await loadTransactions();
            const updated = current.filter(tx => tx.id !== id);
            await saveTransactions(updated);
            refreshData();
          }
        }
      ]
    );
  };

  const exportPDF = async () => {
    const current = await loadTransactions();
    await generatePDF(current);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Advanced Expense Tracker</Text>
      
      <View style={styles.dashboard}>
        <Text style={styles.dashboardLabel}>Total Lifetime Spent</Text>
        <Text style={styles.dashboardTotal}>₹{totalSpent.toFixed(2)}</Text>
        <View style={styles.actionRow}>
          <Button title="Export PDF" onPress={exportPDF} color="#208AEF" />
          <Button title="Manual Entry" onPress={manualEntry} color="#FF9800" />
        </View>
      </View>

      <View style={styles.simRow}>
        <Button title="Scan Past SMS" onPress={handleRequestPerms} />
        <Button title="Simulate GPay" onPress={simulateGPay} color="#4CAF50" />
      </View>

      <SectionList
        sections={groupedTransactions}
        keyExtractor={item => item.id}
        renderSectionHeader={({section: {title}}) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        renderItem={({item}) => (
          <TouchableOpacity onLongPress={() => deleteExpense(item.id)} style={styles.card}>
            <View>
              <Text style={styles.merchant}>{item.merchant}</Text>
              <Text style={styles.account}>{item.account} • {format(new Date(item.date), 'dd MMM, hh:mm a')}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
              <Text style={styles.amount}>- ₹{item.amount}</Text>
              <Text style={styles.hint}>(Hold to delete)</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 20}}>No expenses found.</Text>}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 60, paddingHorizontal: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 10, textAlign: 'center' },
  dashboard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 3, alignItems: 'center' },
  dashboardLabel: { fontSize: 16, color: '#666' },
  dashboardTotal: { fontSize: 32, fontWeight: 'bold', color: '#e53935', marginTop: 8, marginBottom: 15 },
  actionRow: { flexDirection: 'row', gap: 10 },
  simRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', backgroundColor: '#f5f5f5', paddingVertical: 10, color: '#333' },
  card: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 10, elevation: 1 },
  merchant: { fontSize: 16, fontWeight: 'bold' },
  account: { fontSize: 12, color: '#777', marginTop: 4 },
  amount: { fontSize: 16, fontWeight: 'bold', color: '#e53935' },
  hint: { fontSize: 10, color: '#aaa', marginTop: 4 }
});
