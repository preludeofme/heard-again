const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4776, // UI port
  path: '/api/people/family-tree?depthUp=2&depthDown=2&includeSiblings=false',
  method: 'GET',
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    if (res.statusCode === 200) {
      const parsed = JSON.parse(data);
      console.log(`Success: ${parsed.success}`);
      if (parsed.success) {
        console.log(`Data length: ${parsed.data.length}`);
        console.log(`Root: ${parsed.rootPersonId}`);
        if (parsed.data.length > 0) {
            console.log(`Edges for root:`, parsed.data.find(p => p.id === parsed.rootPersonId)?.relationshipEdges);
        }
      } else {
        console.log(`Error:`, parsed.error);
      }
    } else {
      console.log(`Body:`, data);
    }
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.end();
