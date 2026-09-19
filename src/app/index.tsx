import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button, SectionList, Alert, TouchableOpacity, Modal, TextInput } from 'react-native';
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
  const [showDescription, setShowDescription] = useState(false);

  // ... (use existing refreshData / checkNotification / simulateGpay)
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
    const fakeNotif = "Paid Rs. 850 to Swiggy Delivery";
    await processIncomingAlert(fakeNotif, "NOTIFICATION", new Date().toISOString());
    refreshData();
  };

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualMerchant, setManualMerchant] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  const manualEntry = () => {
    setShowManualModal(true);
  };

  const submitManualEntry = async () => {
    if (!manualMerchant || !manualAmount) {
      Alert.alert('Error', 'Merchant and Amount are mandatory.');
      return;
    }
    const newTx = {
      id: uuidv4(),
      amount: parseFloat(manualAmount),
      merchant: manualMerchant,
      account: "Cash",
      date: new Date().toISOString(),
      category: manualCategory || 'Others',
      description: manualDesc || manualMerchant
    };
    const current = await loadTransactions();
    await saveTransactions([newTx, ...current]);
    setShowManualModal(false);
    setManualMerchant('');
    setManualAmount('');
    setManualCategory('');
    setManualDesc('');
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
        <Button title={showDescription ? "Hide Descriptions" : "Show Descriptions"} onPress={() => setShowDescription(!showDescription)} color="#607D8B" />
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
            <View style={{ flex: 1 }}>
              <Text style={styles.merchant}>{item.merchant}</Text>
              <Text style={styles.account}>{item.account} • {format(new Date(item.date), 'dd MMM, hh:mm a')}</Text>
              {showDescription ? (
                <Text style={styles.descText}>Desc: {item.description || 'N/A'}</Text>
              ) : (
                <Text style={styles.catText}>Cat: {item.category || 'Others'}</Text>
              )}
            </View>
            <View style={{alignItems: 'flex-end', marginLeft: 10 }}>
              <Text style={styles.amount}>- ₹{item.amount}</Text>
              <Text style={styles.hint}>(Hold to delete)</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 20}}>No expenses found.</Text>}
      />
      <StatusBar style="auto" />

      {/* Manual Entry Modal */}
      <Modal visible={showManualModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add Expense</Text>
            
            <Text style={styles.modalLabel}>Merchant / Name *</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="e.g. Swiggy"
              value={manualMerchant}
              onChangeText={setManualMerchant}
            />

            <Text style={styles.modalLabel}>Amount *</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="e.g. 150"
              keyboardType="numeric"
              value={manualAmount}
              onChangeText={setManualAmount}
            />

            <Text style={styles.modalLabel}>Category (Optional)</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="e.g. Food"
              value={manualCategory}
              onChangeText={setManualCategory}
            />

            <Text style={styles.modalLabel}>Description (Optional)</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="e.g. Lunch with friends"
              value={manualDesc}
              onChangeText={setManualDesc}
            />

            <View style={styles.modalActionRow}>
              <Button title="Cancel" onPress={() => setShowManualModal(false)} color="#999" />
              <Button title="Add Expense" onPress={submitManualEntry} color="#4CAF50" />
            </View>
          </View>
        </View>
      </Modal>
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
  hint: { fontSize: 10, color: '#aaa', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 5 },
  modalHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalLabel: { fontSize: 14, color: '#555', marginBottom: 5 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 15, fontSize: 16 },
  modalActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  descText: { fontSize: 13, color: '#00796B', marginTop: 4, fontStyle: 'italic' },
  catText: { fontSize: 13, color: '#FF9800', marginTop: 4, fontWeight: '500' }
});
