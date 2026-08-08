import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function buildS3() {
  return new S3Client({
    region: process.env.CLOUD_STORAGE_REGION || 'auto',
    endpoint: process.env.CLOUD_STORAGE_ENDPOINT || undefined,
    forcePathStyle: !!process.env.CLOUD_STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: process.env.CLOUD_STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.CLOUD_STORAGE_SECRET_KEY,
    },
  });
}

const BUCKET = () => process.env.CLOUD_STORAGE_BUCKET || 'aerosys-firmware';

export default async function handler(req, res) {
  const s3 = buildS3();

  if (req.method === 'GET') {
    // List firmware objects
    try {
      const result = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET(), Prefix: 'firmware/' }));
      return res.json({ objects: (result.Contents || []).map(o => ({ key: o.Key, size: o.Size })) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    // Issue signed download URL
    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key required' });

    try {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET(), Key: key }),
        { expiresIn: 900 }
      );
      return res.json({ url, expiresInSeconds: 900 });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
