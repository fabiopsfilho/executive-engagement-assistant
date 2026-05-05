import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { success, error } from '../shared/response';

const s3 = new S3Client({});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const bucket = process.env.EBC_DATA_BUCKET;
    const key = process.env.EBC_DATA_KEY || 'ebc-calendar.csv';

    if (!bucket) {
      return error(500, 'EBC_DATA_BUCKET not configured');
    }

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(command);
    const csvText = await response.Body?.transformToString('utf-8');

    if (!csvText) {
      return error(404, 'No EBC data found. Upload a CSV to the S3 bucket.');
    }

    return success({ csv: csvText });
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e.name === 'NoSuchKey') {
      return error(404, 'No EBC calendar CSV found in S3. Upload your file as "ebc-calendar.csv" to the bucket.');
    }
    console.error('Error reading EBC data:', err);
    return error(500, 'Failed to read EBC data from S3');
  }
}
