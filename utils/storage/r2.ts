// utils/storage/r2.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// 1. Initialize the S3 client pointing to Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function uploadFileToR2(file: File, folder: string): Promise<string> {
  // Convert the web File object into a Node Buffer
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Generate a unique file name to prevent accidental overwrites
  const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9)
  const fileName = `${folder}/${uniquePrefix}-${file.name.replace(/\s+/g, '-')}`

  // 2. Prepare the upload command
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: file.type,
  })

  // 3. Send to Cloudflare
  try {
    await s3Client.send(command)
    // Return the public URL so we can save it in the Supabase database
    return `${process.env.R2_PUBLIC_URL}/${fileName}`
  } catch (error) {
    console.error('Error uploading to R2:', error)
    throw new Error('Failed to upload file.')
  }
}