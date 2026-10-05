import { recognizeText } from 'expo-mlkit-ocr';
import { parseExpense } from './parserEngine';

export const scanReceipt = async (imageUri) => {
  try {
    const result = await recognizeText(imageUri);
    if (!result || !result.text) {
      return { error: "No text found in the image. Please try a clearer screenshot." };
    }
    
    // Custom heuristics for BHIM and GPay screenshots
    const lines = result.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let amount = null;
    let merchant = 'Unknown Merchant';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match Amount (e.g. "₹350.00", "Rs 10", or just plain number if it has commas/decimals and is large)
      const amountMatch = line.match(/(?:Rs\.?|INR|₹|\?|amount|paid)\s*([\d,]+\.?\d*)/i);
      if (amountMatch && !amount) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ''));
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
      
      // Another common format: "Paid to" might just be on a line, and name on next
      if (line.match(/^Paid to$/i) && i + 1 < lines.length && merchant === 'Unknown Merchant') {
        merchant = lines[i + 1].trim();
      }
    }
    
    // If we didn't find an explicit currency symbol, look for standalone numbers like "1,822.00"
    if (!amount) {
      for (let i = 0; i < lines.length; i++) {
        // Try strict decimal match first (e.g. 150.00)
        if (lines[i].match(/^[\d,]+\.\d{2}$/)) {
          amount = parseFloat(lines[i].replace(/,/g, ''));
          break;
        }
      }
    }
    
    if (amount) {
      // Use parseExpense to assign category cleanly
      return parseExpense(`Paid Rs. ${amount} to ${merchant}`, 'NOTIFICATION');
    }
    
    return { error: `Text was read, but could not detect an amount. \nExtracted lines: ${lines.slice(0, 3).join(', ')}...` };
  } catch (error) {
    console.error("OCR Scan Error:", error);
    return { error: `OCR Engine Error: ${error.message || error}` };
  }
};
