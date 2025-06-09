// Volume diagnostic tool to investigate NASDAQ volume spikes
import fetch from 'node-fetch';

async function analyzeVolume() {
  try {
    console.log('Fetching NASDAQ 1D data...');
    const response1D = await fetch('http://localhost:5000/api/stocks/^IXIC/history?range=1D');
    const data1D = await response1D.json();
    
    console.log('Fetching NASDAQ 3M data...');
    const response3M = await fetch('http://localhost:5000/api/stocks/^IXIC/history?range=3M');
    const data3M = await response3M.json();
    
    // Analyze 1D data for volume spikes around 9:50 AM
    console.log('\n=== 1D Volume Analysis ===');
    const morningData = data1D.filter(item => {
      const time = item.time;
      return time.includes('9:') || time.includes('10:');
    });
    
    morningData.forEach(item => {
      const volume = parseInt(item.volume);
      if (volume > 0) {
        console.log(`${item.time}: Volume ${volume.toLocaleString()}`);
      }
    });
    
    // Find highest volume in 1D data
    const maxVolume1D = Math.max(...data1D.map(item => parseInt(item.volume) || 0));
    const maxVolumeItem1D = data1D.find(item => parseInt(item.volume) === maxVolume1D);
    console.log(`\nMax 1D Volume: ${maxVolume1D.toLocaleString()} at ${maxVolumeItem1D?.time}`);
    
    // Analyze 3M data for May 27th spike
    console.log('\n=== 3M Volume Analysis ===');
    const may27Data = data3M.filter(item => {
      const date = new Date(item.timestamp);
      return date.getMonth() === 4 && date.getDate() === 27; // May = month 4
    });
    
    if (may27Data.length > 0) {
      may27Data.forEach(item => {
        const volume = parseInt(item.volume);
        console.log(`May 27: Volume ${volume.toLocaleString()}`);
      });
    } else {
      console.log('No May 27 data found');
    }
    
    // Find highest volume in 3M data
    const maxVolume3M = Math.max(...data3M.map(item => parseInt(item.volume) || 0));
    const maxVolumeItem3M = data3M.find(item => parseInt(item.volume) === maxVolume3M);
    console.log(`\nMax 3M Volume: ${maxVolume3M.toLocaleString()} on ${maxVolumeItem3M?.time}`);
    
    // Calculate average volumes
    const avg1D = data1D.reduce((sum, item) => sum + (parseInt(item.volume) || 0), 0) / data1D.length;
    const avg3M = data3M.reduce((sum, item) => sum + (parseInt(item.volume) || 0), 0) / data3M.length;
    
    console.log(`\nAverage 1D Volume: ${avg1D.toLocaleString()}`);
    console.log(`Average 3M Volume: ${avg3M.toLocaleString()}`);
    
  } catch (error) {
    console.error('Error analyzing volume:', error);
  }
}

analyzeVolume();