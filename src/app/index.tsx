import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SectionList, Alert, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { requestAllPermissions, scanPastSMS } from '../services/smsScanner';
import { loadTransactions, saveTransactions, processIncomingAlert, updateTransaction, deleteTransaction } from '../services/TransactionManager';
import { generatePDF } from '../services/pdfGenerator';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import { format } from 'date-fns';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useShareIntent } from 'expo-share-intent';
import { scanReceipt } from '../services/ocrService';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const CATEGORY_ICONS = {
  'Food & Dining': 'fastfood',
  'Transport': 'local-taxi',
  'Shopping': 'shopping-bag',
  'Utilities': 'lightbulb',
  'Entertainment': 'movie',
  'Healthcare': 'local-hospital',
  'Others': 'receipt'
};

const CATEGORIES = Object.keys(CATEGORY_ICONS);

export default function Index() {
  const [groupedTransactions, setGroupedTransactions] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  
  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formMerchant, setFormMerchant] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Others');
  const [formDesc, setFormDesc] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);

  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();

  useEffect(() => {
    refreshData();
    checkNotificationPermission();
  }, []);

  useEffect(() => {
    if (hasShareIntent && (shareIntent.type === 'media' || shareIntent.type === 'file') && shareIntent.files?.[0]) {
      const uri = shareIntent.files[0].path;
      processOCR(uri);
      resetShareIntent();
    } else if (hasShareIntent && error) {
      console.error("Share Intent Error:", error);
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent]);

  const processOCR = async (uri: string) => {
    setIsScanning(true);
    const parsed = await scanReceipt(uri);
    setIsScanning(false);
    
    if (parsed) {
      setIsEditing(false); 
      setEditingId(null);
      setFormMerchant(parsed.merchant);
      setFormAmount(parsed.amount.toString());
      setFormCategory(parsed.category || 'Others');
      setFormDesc(parsed.merchant);
      setShowExpenseModal(true);
    } else {
      Alert.alert("OCR Failed", "Could not detect amount or merchant from this image.");
    }
  };

  const checkNotificationPermission = async () => {
    const status = await RNAndroidNotificationListener.getPermissionStatus();
    if (status !== 'authorized') {
      Alert.alert(
        'Action Required',
        'Please allow Notification Access to catch real-time payments natively.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => RNAndroidNotificationListener.requestPermission() }
        ]
      );
    }
  };

  const refreshData = async () => {
    const txs = await loadTransactions();
    const total = txs.reduce((sum: number, item: any) => sum + item.amount, 0);
    setTotalSpent(total);

    const groups = txs.reduce((acc: any, tx: any) => {
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

  const handleScanSMS = async () => {
    setIsScanning(true);
    const granted = await requestAllPermissions();
    if (granted) {
      const foundCount = await scanPastSMS();
      await refreshData();
      setIsScanning(false);
      Alert.alert('Scan Complete', `Successfully scanned SMS inbox.\nFound ${foundCount} new matching expenses.`);
    } else {
      setIsScanning(false);
    }
  };

  const handleScanReceipt = async () => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Permission to access gallery is required!");
      return;
    }

    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      processOCR(pickerResult.assets[0].uri);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormMerchant('');
    setFormAmount('');
    setFormCategory('Others');
    setFormDesc('');
    setShowExpenseModal(true);
  };

  const openEditModal = (tx: any) => {
    setIsEditing(true);
    setEditingId(tx.id);
    setFormMerchant(tx.merchant);
    setFormAmount(tx.amount.toString());
    setFormCategory(tx.category || 'Others');
    setFormDesc(tx.description === 'N/A' || tx.description === tx.merchant ? '' : tx.description);
    setShowExpenseModal(true);
  };

  const saveExpense = async () => {
    if (!formMerchant || !formAmount) {
      Alert.alert('Error', 'Merchant and Amount are mandatory.');
      return;
    }
    
    if (isEditing && editingId) {
      await updateTransaction(editingId, {
        merchant: formMerchant,
        amount: parseFloat(formAmount),
        category: formCategory,
        description: formDesc || formMerchant
      });
    } else {
      const newTx = {
        id: generateId(),
        amount: parseFloat(formAmount),
        merchant: formMerchant,
        account: "Cash",
        date: new Date().toISOString(),
        category: formCategory,
        description: formDesc || formMerchant
      };
      const current = await loadTransactions();
      await saveTransactions([newTx, ...current]);
    }

    setShowExpenseModal(false);
    refreshData();
  };

  const handleDelete = () => {
    Alert.alert("Delete Expense", "Are you sure you want to delete this record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          if (editingId) {
            await deleteTransaction(editingId);
            setShowExpenseModal(false);
            refreshData();
          }
      }}
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEditModal(item)}>
      <View style={styles.iconContainer}>
        <MaterialIcons name={(CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS] || 'receipt') as any} size={24} color="#BB86FC" />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.merchantText} numberOfLines={1}>{item.merchant}</Text>
        <Text style={styles.dateText}>{item.account} • {format(new Date(item.date), 'dd MMM, hh:mm a')}</Text>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{item.category}</Text>
        </View>
      </View>
      <View style={styles.amountContainer}>
        <Text style={styles.amountText}>- ₹{item.amount}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header Summary */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Advanced Tracker</Text>
        <Text style={styles.totalLabel}>Total Lifetime Spent</Text>
        <Text style={styles.totalAmount}>₹{totalSpent.toFixed(2)}</Text>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={openAddModal}>
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.actionText}>Add</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionBtn} onPress={handleScanSMS} disabled={isScanning}>
          {isScanning ? <ActivityIndicator color="#fff" /> : <MaterialIcons name="sms" size={24} color="#fff" />}
          <Text style={styles.actionText}>Scan SMS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleScanReceipt}>
          <MaterialIcons name="camera-alt" size={24} color="#fff" />
          <Text style={styles.actionText}>Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={async () => {
          const current = await loadTransactions();
          generatePDF(current);
        }}>
          <MaterialIcons name="picture-as-pdf" size={24} color="#fff" />
          <Text style={styles.actionText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      <SectionList
        sections={groupedTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No expenses logged yet. Tap Add or Scan SMS.</Text>}
      />

      {/* Add / Edit Modal */}
      <Modal visible={showExpenseModal} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isEditing ? 'Edit Expense' : 'Add Expense'}</Text>
            
            <TextInput style={styles.input} placeholder="Amount (₹)" placeholderTextColor="#888" keyboardType="numeric" value={formAmount} onChangeText={setFormAmount} />
            <TextInput style={styles.input} placeholder="Merchant Name" placeholderTextColor="#888" value={formMerchant} onChangeText={setFormMerchant} />
            <TextInput style={styles.input} placeholder="Description (Optional)" placeholderTextColor="#888" value={formDesc} onChangeText={setFormDesc} />
            
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryContainer}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.catBadge, formCategory === cat && styles.catBadgeSelected]} 
                  onPress={() => setFormCategory(cat)}
                >
                  <Text style={[styles.catBadgeText, formCategory === cat && styles.catBadgeTextSelected]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowExpenseModal(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={saveExpense}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
            
            {isEditing && (
              <TouchableOpacity style={styles.modalBtnDelete} onPress={handleDelete}>
                <MaterialIcons name="delete" size={20} color="#CF6679" />
                <Text style={styles.modalBtnDeleteText}>Delete Expense</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20,
    backgroundColor: '#1E1E1E', borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }
  },
  headerTitle: { color: '#BB86FC', fontSize: 18, fontWeight: '600', marginBottom: 15, textAlign: 'center' },
  totalLabel: { color: '#B3B3B3', fontSize: 16, textAlign: 'center' },
  totalAmount: { color: '#FFFFFF', fontSize: 42, fontWeight: 'bold', textAlign: 'center', marginTop: 5 },
  actionsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: 20, marginTop: -25, zIndex: 2
  },
  actionBtn: {
    backgroundColor: '#332940', width: 75, height: 75, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 },
    borderWidth: 1, borderColor: '#4A3B5C'
  },
  actionText: { color: '#E0E0E0', fontSize: 12, marginTop: 5, fontWeight: '500' },
  listContent: { padding: 20, paddingBottom: 100, paddingTop: 40 },
  sectionHeader: { color: '#BB86FC', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, marginLeft: 5 },
  card: {
    flexDirection: 'row', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 16, marginBottom: 12,
    alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
  },
  iconContainer: {
    width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#2C223A',
    justifyContent: 'center', alignItems: 'center', marginRight: 15
  },
  cardInfo: { flex: 1 },
  merchantText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  dateText: { color: '#A0A0A0', fontSize: 12, marginBottom: 6 },
  badgeContainer: { alignSelf: 'flex-start', backgroundColor: '#332940', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#BB86FC', fontSize: 10, fontWeight: '600' },
  amountContainer: { alignItems: 'flex-end', marginLeft: 10 },
  amountText: { color: '#CF6679', fontSize: 18, fontWeight: 'bold' },
  emptyText: { color: '#A0A0A0', textAlign: 'center', marginTop: 50, fontSize: 16 },
  
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, minHeight: 400 },
  modalTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#2C2C2C', color: '#FFFFFF', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#3C3C3C' },
  label: { color: '#A0A0A0', fontSize: 14, marginBottom: 10, marginLeft: 5 },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 25 },
  catBadge: { backgroundColor: '#2C2C2C', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: '#3C3C3C' },
  catBadgeSelected: { backgroundColor: '#BB86FC', borderColor: '#BB86FC' },
  catBadgeText: { color: '#A0A0A0', fontSize: 13 },
  catBadgeTextSelected: { color: '#121212', fontWeight: 'bold' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtnCancel: { flex: 1, backgroundColor: '#2C2C2C', padding: 15, borderRadius: 12, marginRight: 10, alignItems: 'center' },
  modalBtnSave: { flex: 1, backgroundColor: '#BB86FC', padding: 15, borderRadius: 12, marginLeft: 10, alignItems: 'center' },
  modalBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  modalBtnDelete: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 25, padding: 10 },
  modalBtnDeleteText: { color: '#CF6679', fontSize: 16, fontWeight: 'bold', marginLeft: 8 }
});
