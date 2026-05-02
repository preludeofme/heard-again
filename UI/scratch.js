const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4777,
  path: '/api/people/family-tree?depthUp=2&depthDown=2&includeSiblings=false',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2).substring(0, 1500));
    } catch (e) {
      console.log('Error parsing JSON:', e.message);
      console.log(data.substring(0, 500));
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
