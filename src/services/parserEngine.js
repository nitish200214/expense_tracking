// src/services/parserEngine.js

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const getCategory = (merchant) => {
  const lower = merchant.toLowerCase();
  if (lower.match(/swiggy|zomato|starbucks|mcdonald|kfc|burger king|domino|food|pizza/)) return 'Food & Dining';
  if (lower.match(/uber|ola|rapido|irctc|makemytrip|metro|transport|travel|ticket/)) return 'Transport';
  if (lower.match(/amazon|flipkart|myntra|nykaa|reliance|dmart|shopping|mart/)) return 'Shopping';
  if (lower.match(/jio|airtel|vi|bescom|electricity|recharge|bill|broadband/)) return 'Utilities';
  if (lower.match(/netflix|prime|hotstar|spotify|subscription/)) return 'Entertainment';
  if (lower.match(/pharmacy|apollo|medplus|hospital|clinic|health/)) return 'Healthcare';
  return 'Others';
};

export const parseExpense = (text, source = 'UNKNOWN', receivedDate = new Date()) => {
  // Normalize text
  const cleanText = text.replace(/,/g, '');
  
  let amount = null;
  let merchant = 'Unknown Merchant';
  let account = source;
  let type = 'EXPENSE';

  // 1. Check for Notification Formats (GPay, PhonePe, Paytm)
  if (source === 'NOTIFICATION') {
    // e.g. "Paid Rs. 1450 to Swiggy" or "Paid ₹1450 to Swiggy"
    const paidMatch = cleanText.match(/Paid\s*[^\d]*([\d.]+)\s*to\s*(.+)/i);
    if (paidMatch) {
      amount = parseFloat(paidMatch[1]);
      merchant = paidMatch[2].trim();
      return { 
        id: generateId(), amount, merchant: merchant.substring(0, 30), 
        account: 'UPI', date: receivedDate.toISOString(),
        category: getCategory(merchant),
        description: merchant
      };
    }

    // e.g. "Sent Rs. 1500 to Rahul"
    const sentMatch = cleanText.match(/Sent\s*[^\d]*([\d.]+)\s*to\s*(.+)/i);
    if (sentMatch) {
      amount = parseFloat(sentMatch[1]);
      merchant = sentMatch[2].trim();
      return { 
        id: generateId(), amount, merchant: merchant.substring(0, 30), 
        account: 'UPI', date: receivedDate.toISOString(),
        category: getCategory(merchant),
        description: merchant
      };
    }

    // e.g. "Spent Rs. 1500 at Starbucks"
    const spentMatch = cleanText.match(/Spent\s*[^\d]*([\d.]+)\s*(?:at|on)\s*(.+)/i);
    if (spentMatch) {
      amount = parseFloat(spentMatch[1]);
      merchant = spentMatch[2].trim();
      return { 
        id: generateId(), amount, merchant: merchant.substring(0, 30), 
        account: 'Card/UPI', date: receivedDate.toISOString(),
        category: getCategory(merchant),
        description: merchant
      };
    }
  }

  // 2. Check for SMS Formats (Bank Texts)
  // AU Bank
  if (source.includes('AUBANK') || cleanText.includes('AUBANK') || cleanText.includes('AU Bank')) {
    const auMatch = cleanText.match(/(?:Rs\.?|INR)\s*([\d.]+)\s*(?:is debited|spent).*?(?:to|at)\s*(.+?)(?:\s*on\s*[a-zA-Z\s]*Credit Card|\s*on|\s*Ref|\s*\.|$)/i);
    if (auMatch) {
      amount = parseFloat(auMatch[1]);
      merchant = auMatch[2].trim();
      account = 'AU Bank';
    }
  } 
  // Axis Bank
  else if (source.includes('AXIS') || cleanText.includes('Axis')) {
    const axisMatch = cleanText.match(/INR\s*([\d.]+)\s*was spent.*(?:at|on)\s*(.+?)(?:\s*on|\s*avl|\s*\.|$)/i);
    if (axisMatch) {
      amount = parseFloat(axisMatch[1]);
      merchant = axisMatch[2].trim();
      account = 'Axis Bank';
    }
  }
  // PNB
  else if (source.includes('PNB') || cleanText.includes('PNB')) {
    const pnbMatch = cleanText.match(/Rs\.?\s*([\d.]+)\s*has been debited.*(?:to|for)\s*(.+?)(?:\s*on|\s*\.|$)/i);
    if (pnbMatch) {
      amount = parseFloat(pnbMatch[1]);
      merchant = pnbMatch[2].trim();
      account = 'PNB';
    }
  }
  // SBI
  else if (source.includes('SBI') || cleanText.includes('SBI')) {
    const sbiMatch = cleanText.match(/(?:Rs\.?|INR)\s*([\d.]+)\s*debited.*(?:to|Ref(?: no)?[:-])\s*(.+?)(?:\s*on|\s*\.|$)/i);
    if (sbiMatch) {
      amount = parseFloat(sbiMatch[1]);
      merchant = sbiMatch[2].trim();
      account = 'SBI';
    }
  }

  // Generic fallback if amount not found but "debited" is present
  if (!amount && cleanText.match(/debited|spent|paid/i)) {
    const genericAmountMatch = cleanText.match(/(?:Rs\.?|INR|₹|Rs)\s*([\d.]+)/i);
    if (genericAmountMatch) {
      amount = parseFloat(genericAmountMatch[1]);
      merchant = "General Expense";
    }
  }

  if (amount) {
    return {
      id: generateId(),
      amount,
      merchant: merchant.substring(0, 30), // truncate long merchants
      account,
      date: receivedDate.toISOString(),
      category: getCategory(merchant),
      description: merchant !== 'General Expense' && merchant !== 'Unknown Merchant' ? merchant : 'N/A'
    };
  }

  return null;
}
