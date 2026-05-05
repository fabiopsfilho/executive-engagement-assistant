# Executive Engagement Assistant — Backend

Serverless backend powered by AWS Lambda + Amazon Bedrock (Claude) that provides real-time AI-generated executive engagement content.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  API Gateway     │────▶│  Lambda Functions│
│  (Amplify)      │     │  (REST API)      │     │  (Node.js 20)   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                                          ┌────────────────┼────────────────┐
                                          ▼                ▼                ▼
                                   ┌────────────┐  ┌────────────┐  ┌────────────┐
                                   │  Bedrock   │  │  DynamoDB  │  │  DynamoDB  │
                                   │  (Claude)  │  │  (Cache)   │  │  (Convos)  │
                                   └────────────┘  └────────────┘  └────────────┘
```

## Lambda Functions

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `generate-engagement` | `POST /accounts/{id}/engage` | Generates persona-specific narratives, conversation starters, plays, revenue estimates |
| `advisor-chat` | `POST /accounts/{id}/advisor` | AI Advisor with 6 capability modes (coaching, intelligence, research, content, workflow, analytics) |
| `roleplay` | `POST /accounts/{id}/roleplay` | Role-play engine — AI responds in-character as the target executive with coaching tips |
| `intelligence` | `GET /accounts/{id}/intelligence` | Aggregates public intelligence (earnings, LinkedIn, Glassdoor, news) via Bedrock |
| `generate-agenda` | `POST /accounts/{id}/agenda` | Generates EBC or Training Session agendas grounded in Leadership Principles |
| `generate-pitch` | `POST /accounts/{id}/pitch` | Generates persona-specific pitch decks with speaker notes |

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 20+
3. AWS CDK CLI: `npm install -g aws-cdk`
4. Amazon Bedrock access enabled for Claude Sonnet in us-east-1

## Deploy

```bash
cd backend
npm install
cdk bootstrap   # First time only
cdk deploy
```

After deployment, CDK outputs the API Gateway URL. Set it in the frontend:

```bash
# In the project root
echo "VITE_API_URL=<your-api-url>" > .env
```

## Bedrock Model

Default: `anthropic.claude-sonnet-4-20250514`

To change, update the `BEDROCK_MODEL_ID` environment variable in `lib/stack.ts`.

## DynamoDB Tables

| Table | Purpose | TTL |
|-------|---------|-----|
| `engagement-assistant-accounts` | Account data cache | None |
| `engagement-assistant-intelligence-cache` | Public intelligence cache | 24 hours |
| `engagement-assistant-conversations` | Role-play & advisor conversation history | 7 days |

## Cost Estimate

At moderate usage (50 sellers, 5 engagements/week each):
- Bedrock: ~$200-400/month (Claude Sonnet)
- Lambda: ~$5-10/month (pay per invocation)
- DynamoDB: ~$5/month (on-demand)
- API Gateway: ~$10/month
- **Total: ~$220-425/month**

## Security

- API Gateway can be secured with IAM auth or Cognito (for Midway/Federate SSO)
- Bedrock calls are IAM-authorized (no API keys)
- DynamoDB encrypted at rest by default
- No customer PII stored — only public intelligence and conversation context

## Next Steps

1. Add Cognito authorizer for Amazon SSO (Midway)
2. Connect Salesforce API for real account data
3. Add LinkedIn/news scraping pipeline for live intelligence
4. Add CloudWatch dashboards for usage monitoring
5. Add feedback loop (did the engagement convert?)
