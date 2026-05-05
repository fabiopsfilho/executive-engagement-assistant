import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
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

    // ─── Shared Lambda Environment ──────────────────────────────────────
    const sharedEnv = {
      ACCOUNTS_TABLE: accountsTable.tableName,
      INTELLIGENCE_CACHE_TABLE: intelligenceCache.tableName,
      CONVERSATIONS_TABLE: conversationsTable.tableName,
      BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      BEDROCK_REGION: 'us-east-1',
    };

    // ─── Bedrock IAM Policy ─────────────────────────────────────────────
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['arn:aws:bedrock:*::foundation-model/*'],
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

    // Grant permissions
    const allFunctions = [generateEngagementFn, advisorChatFn, rolePlayFn, intelligenceFn, agendaFn, pitchFn];
    for (const fn of allFunctions) {
      fn.addToRolePolicy(bedrockPolicy);
      accountsTable.grantReadWriteData(fn);
      intelligenceCache.grantReadWriteData(fn);
      conversationsTable.grantReadWriteData(fn);
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

    // ─── Outputs ────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
  }
}

const app = new cdk.App();
new EngagementAssistantStack(app, 'EngagementAssistantStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
