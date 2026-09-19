import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';

export const generatePDF = async (transactions) => {
  const tableRows = transactions.map(tx => `
    <tr>
      <td>${format(new Date(tx.date), 'dd MMM yyyy, hh:mm a')}</td>
      <td>${tx.merchant}</td>
      <td>${tx.account}</td>
      <td class="amount">₹${tx.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  const html = `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
          h1 { text-align: center; color: #208AEF; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f8f9fa; font-weight: bold; }
          .amount { color: #e53935; font-weight: bold; }
          .total-row td { font-weight: bold; font-size: 16px; background-color: #f1f1f1; }
        </style>
      </head>
      <body>
        <h1>Expense Statement</h1>
        <p>Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Account</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td colspan="3" style="text-align: right;">Total Spent:</td>
              <td class="amount">₹${total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      console.log('Sharing not available, PDF saved at: ', uri);
    }
  } catch (err) {
    console.error('Failed to generate PDF', err);
  }
};
