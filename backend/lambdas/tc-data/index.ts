import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as XLSX from 'xlsx';
import { success, error } from '../shared/response';

const s3 = new S3Client({});

interface TCOpportunity {
  accountId: string;
  accountName: string;
  opportunityName: string;
  productName: string;
  productFamily: string;
  stage: string;
  forecastStatus: string;
  closeDate: string;
  amount: number;
  totalOpportunity: number;
  numberOfStudents: number;
  trainingDeliveryType: string;
  subscriptionType: string;
  isT2K: string;
  geo: string;
  segment: string;
  skillBuilderAddOn: string;
}

interface AccountTCSummary {
  accountId: string;
  accountName: string;
  totalPipeline: number;
  openOpportunities: number;
  closedWonRevenue: number;
  products: string[];
  subscriptionTypes: string[];
  totalStudents: number;
  isT2K: boolean;
  opportunities: TCOpportunity[];
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const bucket = process.env.EBC_DATA_BUCKET;
    const key = 'tc-opportunities.xlsx';
    const accountId = event.queryStringParameters?.accountId;

    if (!bucket) {
      return error(500, 'EBC_DATA_BUCKET not configured');
    }

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(command);
    const buffer = await response.Body?.transformToByteArray();

    if (!buffer) {
      return error(404, 'No T&C data found. Upload tc-opportunities.xlsx to the S3 bucket.');
    }

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);

    // Parse opportunities
    const opportunities: TCOpportunity[] = rows.map(row => ({
      accountId: String(row['18 Character Account ID'] || ''),
      accountName: String(row['Account Name'] || ''),
      opportunityName: String(row['Opportunity Name'] || ''),
      productName: String(row['Product Name'] || ''),
      productFamily: String(row['Product Family'] || ''),
      stage: String(row['Stage'] || ''),
      forecastStatus: String(row['Forecast Status'] || ''),
      closeDate: String(row['Close Date'] || ''),
      amount: Number(row['Product Net Amount (converted)'] || 0),
      totalOpportunity: Number(row['Total Opportunity (converted)'] || 0),
      numberOfStudents: Number(row['Number of Students'] || 0),
      trainingDeliveryType: String(row['Training Delivery Type'] || ''),
      subscriptionType: String(row['Subscription Type'] || ''),
      isT2K: String(row['Is T2K'] || ''),
      geo: String(row['Geo'] || ''),
      segment: String(row['Segment'] || ''),
      skillBuilderAddOn: String(row['AWS Skill Builder Add On'] || ''),
    }));

    // If accountId is provided, filter to that account
    if (accountId) {
      const accountOpps = opportunities.filter(o => o.accountId === accountId);
      if (accountOpps.length === 0) {
        return success({ accountId, summary: null, message: 'No T&C opportunities found for this account' });
      }

      const summary: AccountTCSummary = {
        accountId,
        accountName: accountOpps[0].accountName,
        totalPipeline: accountOpps.filter(o => !['Closed Won', 'Closed Lost'].includes(o.stage)).reduce((sum, o) => sum + o.totalOpportunity, 0),
        openOpportunities: accountOpps.filter(o => !['Closed Won', 'Closed Lost'].includes(o.stage)).length,
        closedWonRevenue: accountOpps.filter(o => o.stage === 'Closed Won').reduce((sum, o) => sum + o.amount, 0),
        products: [...new Set(accountOpps.map(o => o.productName).filter(Boolean))],
        subscriptionTypes: [...new Set(accountOpps.map(o => o.subscriptionType).filter(Boolean))],
        totalStudents: accountOpps.reduce((sum, o) => sum + o.numberOfStudents, 0),
        isT2K: accountOpps.some(o => o.isT2K === 'true' || o.isT2K === 'TRUE'),
        opportunities: accountOpps,
      };

      return success({ accountId, summary });
    }

    // Return all accounts summary
    const accountMap = new Map<string, TCOpportunity[]>();
    for (const opp of opportunities) {
      if (!opp.accountId) continue;
      if (!accountMap.has(opp.accountId)) accountMap.set(opp.accountId, []);
      accountMap.get(opp.accountId)!.push(opp);
    }

    const summaries: AccountTCSummary[] = [...accountMap.entries()].map(([id, opps]) => ({
      accountId: id,
      accountName: opps[0].accountName,
      totalPipeline: opps.filter(o => !['Closed Won', 'Closed Lost'].includes(o.stage)).reduce((sum, o) => sum + o.totalOpportunity, 0),
      openOpportunities: opps.filter(o => !['Closed Won', 'Closed Lost'].includes(o.stage)).length,
      closedWonRevenue: opps.filter(o => o.stage === 'Closed Won').reduce((sum, o) => sum + o.amount, 0),
      products: [...new Set(opps.map(o => o.productName).filter(Boolean))],
      subscriptionTypes: [...new Set(opps.map(o => o.subscriptionType).filter(Boolean))],
      totalStudents: opps.reduce((sum, o) => sum + o.numberOfStudents, 0),
      isT2K: opps.some(o => o.isT2K === 'true' || o.isT2K === 'TRUE'),
      opportunities: opps,
    }));

    return success({
      totalAccounts: summaries.length,
      totalOpportunities: opportunities.length,
      summaries: summaries.sort((a, b) => b.totalPipeline - a.totalPipeline),
    });
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e.name === 'NoSuchKey') {
      return error(404, 'No T&C opportunities file found. Upload tc-opportunities.xlsx to the S3 bucket.');
    }
    console.error('Error reading T&C data:', err);
    return error(500, 'Failed to read T&C data');
  }
}
