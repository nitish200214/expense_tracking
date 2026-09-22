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
    
    // If standard parser fails, let's try custom heuristics for BHIM and GPay screenshots
    const lines = result.text.split('\n');
    let amount = null;
    let merchant = 'Unknown Merchant';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match Amount (e.g. "₹350.00", "₹10")
      const amountMatch = line.match(/(?:Rs\.?|INR|₹|\?)\s*([\d.]+)/i);
      if (amountMatch && !amount) {
        amount = parseFloat(amountMatch[1]);
      }
      
      // GPay Match: "To Jyothi Kattamuri" or "Paid to X"
      const gpayMatch = line.match(/^(?:To|Paid to|Paying|Sent to)\s+(.+)/i);
      if (gpayMatch && merchant === 'Unknown Merchant') {
        merchant = gpayMatch[1].trim();
      }
      
      // BHIM Match: "Banking Name" usually precedes the merchant's name on the next line
      if (line.match(/Banking Name/i) && i + 1 < lines.length) {
        merchant = lines[i + 1].trim();
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
