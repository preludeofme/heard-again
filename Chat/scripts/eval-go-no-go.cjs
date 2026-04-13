process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'commonjs',
  moduleResolution: 'node',
})

require('ts-node/register')
require('./eval-go-no-go.ts')
