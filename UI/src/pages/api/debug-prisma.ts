import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const result: any = {}
  try {
    const { PrismaClient } = require('@prisma/client')
    result.prisma = !!PrismaClient
  } catch (e: any) {
    result.prismaError = e.message
  }

  try {
    const s3 = require('@aws-sdk/client-s3')
    result.s3 = !!s3
  } catch (e: any) {
    result.s3Error = e.message
  }

  try {
    const sharp = require('sharp')
    result.sharp = !!sharp
  } catch (e: any) {
    result.sharpError = e.message
  }
  
  try {
    const gcStorage = require('@google-cloud/storage')
    result.gcStorage = !!gcStorage
  } catch (e: any) {
    result.gcStorageError = e.message
  }
  
  try {
    const bullmq = require('bullmq')
    result.bullmq = !!bullmq
  } catch (e: any) {
    result.bullmqError = e.message
  }

  res.status(200).json(result)
}
