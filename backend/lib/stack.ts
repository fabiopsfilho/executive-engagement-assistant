import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

class EngagementAssistantStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── DynamoDB Tables ────────────────────────────────────────────────
    const accountsTable = new dynamodb.Table(this, 'AccountsTable', {
      tableName: 'engagement-assistant-accounts',
      partitionKey: { name: 'accountId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const intelligenceCache = new dynamodb.Table(this, 'IntelligenceCache', {
      tableName: 'engagement-assistant-intelligence-cache',
      partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const conversationsTable = new dynamodb.Table(this, 'ConversationsTable', {
      tableName: 'engagement-assistant-conversations',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── S3 Bucket for EBC Data ────────────────────────────────────────
    const ebcDataBucket = new s3.Bucket(this, 'EBCDataBucket', {
      bucketName: `engagement-assistant-ebc-data-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // ─── Shared Lambda Environment ──────────────────────────────────────
    const sharedEnv = {
      ACCOUNTS_TABLE: accountsTable.tableName,
      INTELLIGENCE_CACHE_TABLE: intelligenceCache.tableName,
      CONVERSATIONS_TABLE: conversationsTable.tableName,
      BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      BEDROCK_REGION: 'us-east-1',
      EBC_DATA_BUCKET: ebcDataBucket.bucketName,
      EBC_DATA_KEY: 'ebc-calendar.csv',
      KNOWLEDGE_BASE_ID: 'TJHYCVRLXH',
      KB_VERSION: '1',
    };

    // ─── Bedrock IAM Policy ─────────────────────────────────────────────
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream', 'bedrock:Retrieve'],
      resources: ['arn:aws:bedrock:*::foundation-model/*', 'arn:aws:bedrock:*:*:inference-profile/*', 'arn:aws:bedrock:*:*:knowledge-base/*'],
    });

    // ─── Lambda Functions ───────────────────────────────────────────────

    // 1. Generate Engagement Plan (persona-specific narrative, starters, plays)
    const generateEngagementFn = new NodejsFunction(this, 'GenerateEngagementFn', {
      functionName: 'engagement-assistant-generate',
      entry: path.join(__dirname, '../lambdas/generate-engagement/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: sharedEnv,
    });

    // 2. AI Advisor Chat
    const advisorChatFn = new NodejsFunction(this, 'AdvisorChatFn', {
      functionName: 'engagement-assistant-advisor',
      entry: path.join(__dirname, '../lambdas/advisor-chat/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: sharedEnv,
    });

    // 3. Role-Play Engine
    const rolePlayFn = new NodejsFunction(this, 'RolePlayFn', {
      functionName: 'engagement-assistant-roleplay',
      entry: path.join(__dirname, '../lambdas/roleplay/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: sharedEnv,
    });

    // 4. Intelligence Aggregation (public signals)
    const intelligenceFn = new NodejsFunction(this, 'IntelligenceFn', {
      functionName: 'engagement-assistant-intelligence',
      entry: path.join(__dirname, '../lambdas/intelligence/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
      environment: sharedEnv,
    });

    // 5. Generate Agenda
    const agendaFn = new NodejsFunction(this, 'AgendaFn', {
      functionName: 'engagement-assistant-agenda',
      entry: path.join(__dirname, '../lambdas/generate-agenda/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: sharedEnv,
    });

    // 6. Generate Pitch Deck
    const pitchFn = new NodejsFunction(this, 'PitchFn', {
      functionName: 'engagement-assistant-pitch',
      entry: path.join(__dirname, '../lambdas/generate-pitch/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: sharedEnv,
    });

    // 7. Load EBC Data from S3
    const ebcDataFn = new NodejsFunction(this, 'EBCDataFn', {
      functionName: 'engagement-assistant-ebc-data',
      entry: path.join(__dirname, '../lambdas/ebc-data/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: sharedEnv,
    });

    // 8. Load T&C Opportunity Data from S3 (xlsx)
    const tcDataFn = new NodejsFunction(this, 'TCDataFn', {
      functionName: 'engagement-assistant-tc-data',
      entry: path.join(__dirname, '../lambdas/tc-data/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: sharedEnv,
      bundling: {
        externalModules: ['@aws-sdk/*', 'xlsx'],
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [`cp -r ${inputDir}/node_modules/xlsx ${outputDir}/node_modules/xlsx 2>/dev/null || true`];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // 9. Account Insights (AI-generated strategic insights per account)
    const accountInsightsFn = new NodejsFunction(this, 'AccountInsightsFn', {
      functionName: 'engagement-assistant-account-insights',
      entry: path.join(__dirname, '../lambdas/account-insights/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: sharedEnv,
    });

    // Grant permissions
    const allFunctions = [generateEngagementFn, advisorChatFn, rolePlayFn, intelligenceFn, agendaFn, pitchFn, ebcDataFn, tcDataFn, accountInsightsFn];
    for (const fn of allFunctions) {
      fn.addToRolePolicy(bedrockPolicy);
      accountsTable.grantReadWriteData(fn);
      intelligenceCache.grantReadWriteData(fn);
      conversationsTable.grantReadWriteData(fn);
      ebcDataBucket.grantRead(fn);
    }

    // ─── API Gateway ────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'EngagementAssistantApi', {
      restApiName: 'Executive Engagement Assistant API',
      description: 'Backend API for the Executive Engagement Assistant',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
      },
    });

    // Routes
    const accounts = api.root.addResource('accounts');
    const account = accounts.addResource('{accountId}');

    // POST /accounts/{accountId}/engage
    const engage = account.addResource('engage');
    engage.addMethod('POST', new apigateway.LambdaIntegration(generateEngagementFn));

    // POST /accounts/{accountId}/advisor
    const advisor = account.addResource('advisor');
    advisor.addMethod('POST', new apigateway.LambdaIntegration(advisorChatFn));

    // POST /accounts/{accountId}/roleplay
    const roleplay = account.addResource('roleplay');
    roleplay.addMethod('POST', new apigateway.LambdaIntegration(rolePlayFn));

    // GET /accounts/{accountId}/intelligence
    const intelligence = account.addResource('intelligence');
    intelligence.addMethod('GET', new apigateway.LambdaIntegration(intelligenceFn));

    // POST /accounts/{accountId}/agenda
    const agenda = account.addResource('agenda');
    agenda.addMethod('POST', new apigateway.LambdaIntegration(agendaFn));

    // POST /accounts/{accountId}/pitch
    const pitch = account.addResource('pitch');
    pitch.addMethod('POST', new apigateway.LambdaIntegration(pitchFn));

    // POST /accounts/{accountId}/insights
    const insights = account.addResource('insights');
    insights.addMethod('POST', new apigateway.LambdaIntegration(accountInsightsFn));

    // GET /ebc-data (load EBC calendar from S3)
    const ebcData = api.root.addResource('ebc-data');
    ebcData.addMethod('GET', new apigateway.LambdaIntegration(ebcDataFn));

    // GET /tc-data (load T&C opportunities from S3)
    const tcData = api.root.addResource('tc-data');
    tcData.addMethod('GET', new apigateway.LambdaIntegration(tcDataFn));

    // ─── Outputs ────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'EBCDataBucketName', {
      value: ebcDataBucket.bucketName,
      description: 'S3 bucket for EBC calendar CSV — drop your file here',
    });
  }
}

const app = new cdk.App();
new EngagementAssistantStack(app, 'EngagementAssistantStack', {
  env: {
    account: '678278062910',
    region: 'us-east-1',
  },
});
