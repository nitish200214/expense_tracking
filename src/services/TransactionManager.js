import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseExpense } from './parserEngine';

const STORAGE_KEY = '@advanced_expenses';

export const loadTransactions = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load transactions', e);
    return [];
  }
};

export const saveTransactions = async (transactions) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to save transactions', e);
  }
};

export const processIncomingAlert = async (text, source, dateStamp) => {
  const newExpense = parseExpense(text, source, new Date(dateStamp));
  if (!newExpense) return false;

  const currentTransactions = await loadTransactions();
  
  // Deduplication Engine
  // Check if an expense with the same amount happened within the last 5 minutes
  const newExpDate = new Date(newExpense.date);
  const isDuplicate = currentTransactions.some(tx => {
    if (tx.amount === newExpense.amount) {
      const txDate = new Date(tx.date);
      const timeDiffMins = Math.abs(newExpDate - txDate) / (1000 * 60);
      if (timeDiffMins < 5) return true; // It's a duplicate!
    }
    return false;
  });

  if (isDuplicate) {
    console.log('Duplicate detected, ignoring.');
    return false;
  }

  // Add new expense
  const updatedTransactions = [newExpense, ...currentTransactions];
  // Sort chronologically (newest first)
  updatedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  await saveTransactions(updatedTransactions);
  return true; // Indicates an update happened
};

export const updateTransaction = async (id, updatedData) => {
  const currentTransactions = await loadTransactions();
  const updatedTransactions = currentTransactions.map(tx => 
    tx.id === id ? { ...tx, ...updatedData } : tx
  );
  await saveTransactions(updatedTransactions);
};

export const deleteTransaction = async (id) => {
  const currentTransactions = await loadTransactions();
  const filtered = currentTransactions.filter(tx => tx.id !== id);
  await saveTransactions(filtered);
};

