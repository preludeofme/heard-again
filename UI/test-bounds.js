import { getNodesBounds } from '@xyflow/react'

const nodes = [
  { id: '1', position: { x: 100, y: 100 }, width: 200, height: 300 },
  { id: '2', position: { x: 400, y: 100 }, measured: { width: 200, height: 300 } }
]

console.log(getNodesBounds(nodes))
