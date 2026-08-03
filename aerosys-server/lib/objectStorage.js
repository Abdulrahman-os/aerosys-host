// lib/objectStorage.js — S3-compatible object storage client.
// Works against AWS S3 itself, or any S3-compatible endpoint (MinIO,
// Cloudflare R2, Backblaze B2, or your own console) by overriding the
// endpoint. Uses the standard AWS SDK v3, which speaks the S3 API dialect
// that "S3-compatible" storage implementations all implement.
//
// Setup (add to .env):
//   CLOUD_STORAGE_ENDPOINT=https://your-console-host/s3        // your console's S3-compatible endpoint
//   CLOUD_STORAGE_REGION=auto                                   // or a real AWS region if using real S3
//   CLOUD_STORAGE_ACCESS_KEY=xxx
//   CLOUD_STORAGE_SECRET_KEY=xxx
//   CLOUD_STORAGE_BUCKET=aerosys-firmware                       // default bucket for firmware downloads
//
// Requires: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function buildClient() {
  const endpoint = process.env.CLOUD_STORAGE_ENDPOINT;
  const accessKeyId = process.env.CLOUD_STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.CLOUD_STORAGE_SECRET_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('CLOUD_STORAGE_ACCESS_KEY / CLOUD_STORAGE_SECRET_KEY not set in environment.');
  }

  return new S3Client({
    region: process.env.CLOUD_STORAGE_REGION || 'auto',
    endpoint: endpoint || undefined, // omit to use real AWS S3
    forcePathStyle: !!endpoint,      // most S3-compatible services need path-style addressing
    credentials: { accessKeyId, secretAccessKey },
  });
}

const DEFAULT_BUCKET = process.env.CLOUD_STORAGE_BUCKET || 'aerosys-firmware';

export async function uploadObject(key, body, contentType = 'application/octet-stream', bucket = DEFAULT_BUCKET) {
  const client = buildClient();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return { bucket, key };
}

export async function listObjects(prefix = '', bucket = DEFAULT_BUCKET) {
  const client = buildClient();
  const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  return (result.Contents || []).map(o => ({ key: o.Key, size: o.Size, lastModified: o.LastModified }));
}

export async function deleteObject(key, bucket = DEFAULT_BUCKET) {
  const client = buildClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return { deleted: key };
}

// Generates a time-limited signed download URL — this is what the firmware
// store's "Checkout & Download" button should call after a successful
// Stripe payment, instead of exposing a permanent public link.
export async function getSignedDownloadUrl(key, bucket = DEFAULT_BUCKET, expiresInSeconds = 900) {
  const client = buildClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
