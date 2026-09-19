// Regex Engine for Indian Banks

export const parseBankSMS = (messageBody, senderId) => {
  // Common keywords to ignore
  const ignoreKeywords = ['OTP', 'balance', 'credited', 'login', 'added'];
  if (ignoreKeywords.some(keyword => messageBody.toLowerCase().includes(keyword))) {
    return null; // Not an expense
  }

  let amount = null;
  let merchant = 'Unknown';
  let account = 'Unknown';
  let date = new Date().toISOString();

  // 1. AU Small Finance Bank
  if (senderId.includes('AUBANK')) {
    // Example: Rs 500.00 debited from a/c **1234 on 01-Jan. Info: Amazon.
    const amtMatch = messageBody.match(/(?:Rs\.?|INR)\s*(\d+(?:\.\d{1,2})?)/i);
    const accMatch = messageBody.match(/a\/c.*(\d{4})/i);
    const merchMatch = messageBody.match(/Info:\s*(.+?)(?:\.|$)/i);

    if (amtMatch) amount = parseFloat(amtMatch[1]);
    if (accMatch) account = `AU Bank (**${accMatch[1]})`;
    if (merchMatch) merchant = merchMatch[1].trim();
  }
  
  // 2. Axis Bank (Credit Card)
  else if (senderId.includes('AXISBK')) {
    // Example: Transaction of INR 1000.00 on Axis Bank CC XX9999 at Starbucks.
    const amtMatch = messageBody.match(/(?:Rs\.?|INR)\s*(\d+(?:\.\d{1,2})?)/i);
    const accMatch = messageBody.match(/CC XX(\d{4})/i);
    const merchMatch = messageBody.match(/at\s+(.+?)(?:\.|$)/i);

    if (amtMatch) amount = parseFloat(amtMatch[1]);
    if (accMatch) account = `Axis CC (**${accMatch[1]})`;
    if (merchMatch) merchant = merchMatch[1].trim();
  }

  // 3. Punjab National Bank (PNB)
  else if (senderId.includes('PNBSMS')) {
     // Example: Your A/C XXXXXX1234 is debited by Rs. 200.00 on 01/01/2026.
     const amtMatch = messageBody.match(/(?:Rs\.?|INR)\s*(\d+(?:\.\d{1,2})?)/i);
     const accMatch = messageBody.match(/A\/C\s*X+(\d{4})/i);
     
     if (amtMatch) amount = parseFloat(amtMatch[1]);
     if (accMatch) account = `PNB (**${accMatch[1]})`;
  }

  // 4. State Bank of India (SBI)
  else if (senderId.includes('SBI')) {
     // Example: Dear SBI User, Rs.100.00 debited from A/c No. XX1111 on 01/01/26. Ref: UPI/123/Swiggy.
     const amtMatch = messageBody.match(/(?:Rs\.?|INR)\s*(\d+(?:\.\d{1,2})?)/i);
     const accMatch = messageBody.match(/A\/c No\.\s*X+(\d{4})/i);
     const merchMatch = messageBody.match(/Ref:\s*UPI\/\d+\/(.+?)(?:\.|$)/i);

     if (amtMatch) amount = parseFloat(amtMatch[1]);
     if (accMatch) account = `SBI (**${accMatch[1]})`;
     if (merchMatch) merchant = merchMatch[1].trim();
  }

  // Return formatted transaction if it looks like a valid debit
  if (amount !== null && (messageBody.toLowerCase().includes('debited') || messageBody.toLowerCase().includes('spent') || messageBody.toLowerCase().includes('transaction'))) {
    return {
      id: Math.random().toString(36).substr(2, 9), // simple unique ID
      amount: amount,
      merchant: merchant,
      account: account,
      date: date,
      rawMessage: messageBody
    };
  }

  return null;
};
