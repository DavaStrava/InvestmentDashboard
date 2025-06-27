import fs from 'fs';
import csv from 'csv-parser';

function testCSVParsing() {
  const results = [];
  
  fs.createReadStream('attached_assets/Portfolio_1750998621425.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      console.log('Total rows:', results.length);
      
      // Find header row
      let headerRowIndex = -1;
      let headerRow = {};
      
      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        const keys = Object.keys(row);
        
        if (keys.some(key => key.toLowerCase().trim().includes('symbol'))) {
          headerRowIndex = i;
          headerRow = row;
          break;
        }
      }
      
      console.log('Header row index:', headerRowIndex);
      console.log('Header columns:', Object.keys(headerRow));
      
      // Show first few data rows
      const dataRows = results.slice(headerRowIndex + 1, headerRowIndex + 6);
      console.log('\nFirst 5 data rows:');
      dataRows.forEach((row, idx) => {
        const keys = Object.keys(row);
        console.log(`Row ${idx + 1}:`, keys.map(key => `${key}: "${row[key]}"`));
      });
      
      // Test parsing logic
      console.log('\nTesting field extraction:');
      const testRow = dataRows[0];
      if (testRow) {
        const normalizedRow = {};
        Object.keys(testRow).forEach(key => {
          const normalizedKey = key.toLowerCase().trim();
          normalizedRow[normalizedKey] = testRow[key];
        });
        
        const symbol = normalizedRow.symbol || normalizedRow['symbol '] || normalizedRow.ticker;
        const companyName = normalizedRow.description || normalizedRow.companyname || normalizedRow.company;
        const shares = normalizedRow.quantity || normalizedRow.shares;
        const avgCostPerShare = normalizedRow['unit cost'] || normalizedRow.unitcost || normalizedRow.price;
        
        console.log('Extracted fields:');
        console.log('Symbol:', symbol);
        console.log('Company:', companyName);
        console.log('Shares:', shares);
        console.log('Unit Cost:', avgCostPerShare);
      }
    });
}

testCSVParsing();