import { recognizeText } from 'expo-mlkit-ocr';
import { parseExpense } from './parserEngine';

export const scanReceipt = async (imageUri) => {
  try {
    const result = await recognizeText(imageUri);
    console.log("OCR Result Text:", result.text);
    
    // Attempt to parse using our standard regexes first
    let parsed = parseExpense(result.text, 'OCR');
    
    if (parsed) {
      return parsed;
    }
    
    // If standard parser fails, let's try some custom heuristics for screenshots
    const lines = result.text.split('\n');
    let amount = null;
    let merchant = 'Unknown Merchant';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Search for amount-like strings
      const amountMatch = line.match(/(?:Rs\.?|INR|₹)\s*([\d.]+)/i);
      if (amountMatch && !amount) {
        amount = parseFloat(amountMatch[1]);
      }
      
      // Search for "Paid to", "Paying"
      if (line.match(/Paid to|Paying|Sent to/i)) {
        // usually the next line or the rest of the line has the name
        const matchName = line.match(/(?:Paid to|Paying|Sent to)\s*(.+)/i);
        if (matchName && matchName[1].trim().length > 0) {
          merchant = matchName[1].trim();
        } else if (i + 1 < lines.length) {
          merchant = lines[i + 1].trim();
        }
      }
    }
    
    if (amount) {
      // Re-use parseExpense to format it correctly and assign category/ID
      return parseExpense(`Paid Rs. ${amount} to ${merchant}`, 'NOTIFICATION');
    }
    
    return null;
  } catch (error) {
    console.error("OCR Scan Error:", error);
    return null;
  }
};
