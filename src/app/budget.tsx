import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, SafeAreaView, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTransactions } from '../services/TransactionManager';

import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

export default function BudgetScreen() {
  const [budgetLimit, setBudgetLimit] = useState('');
  const [currentTotal, setCurrentTotal] = useState(0);
  const [savedBudget, setSavedBudget] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      loadBudgetData();
    }, [])
  );

  const loadBudgetData = async () => {
    try {
      const storedBudget = await AsyncStorage.getItem('@budget_limit');
      if (storedBudget) {
        setSavedBudget(parseFloat(storedBudget));
        setBudgetLimit(storedBudget);
      }
      const transactions = await loadTransactions();
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const monthlyTotal = transactions
        .filter((tx: any) => {
          const date = new Date(tx.date);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        })
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount || 0), 0);
        
      setCurrentTotal(monthlyTotal);
    } catch (e) {
      console.error(e);
    }
  };

  const saveBudget = async () => {
    if (!budgetLimit || isNaN(Number(budgetLimit))) {
      Alert.alert('Invalid', 'Please enter a valid number for budget.');
      return;
    }
    try {
      await AsyncStorage.setItem('@budget_limit', budgetLimit);
      setSavedBudget(parseFloat(budgetLimit));
      Alert.alert('Success', 'Budget limit updated!');
    } catch (e) {
      console.error(e);
    }
  };

  const progress = savedBudget > 0 ? Math.min(currentTotal / savedBudget, 1) : 0;
  const isOverBudget = currentTotal > savedBudget && savedBudget > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Monthly Budget</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Set your monthly limit:</Text>
        <TextInput 
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 5000"
          placeholderTextColor="#777"
          value={budgetLimit}
          onChangeText={setBudgetLimit}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={saveBudget}>
          <Text style={styles.saveBtnText}>Save Budget</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Current Month: ₹{currentTotal.toFixed(2)}</Text>
        <Text style={styles.statsSubtitle}>
          {savedBudget > 0 ? `Limit: ₹${savedBudget.toFixed(2)}` : 'No limit set'}
        </Text>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: isOverBudget ? '#CF6679' : '#03DAC6' }]} />
        </View>

        {isOverBudget && (
          <Text style={styles.warningText}>⚠️ You have exceeded your monthly budget!</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  title: {
    color: '#BB86FC',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 4,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#BB86FC',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statsCard: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    elevation: 4,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 20,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#333',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 5,
  },
  warningText: {
    color: '#CF6679',
    marginTop: 15,
    fontWeight: 'bold',
  }
});
