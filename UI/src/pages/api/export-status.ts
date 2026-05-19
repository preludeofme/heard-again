import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { jobId } = req.query

  if (!jobId) {
    return res.status(400).json({ success: false, error: 'Missing jobId' })
  }

  try {
    const runpodUrl = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/status/${jobId}`
    const response = await fetch(runpodUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
      }
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`RunPod API Error: ${errText}`)
    }

    const data = await response.json()

    // data.status will be 'IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', or 'FAILED'
    if (data.status === 'COMPLETED') {
      return res.status(200).json({
        success: true,
        status: data.status,
        downloadUrl: data.output?.downloadUrl,
      })
    } else if (data.status === 'FAILED') {
      return res.status(200).json({
        success: false,
        status: data.status,
        error: data.error || 'Job failed',
      })
    } else {
      return res.status(200).json({
        success: true,
        status: data.status,
      })
    }
  } catch (error: any) {
    console.error('Failed to check RunPod status:', error)
    return res.status(500).json({ success: false, error: 'Internal Server Error' })
  }
}
