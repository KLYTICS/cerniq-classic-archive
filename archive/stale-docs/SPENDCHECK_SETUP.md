# SpendCheck Setup & Installation

Quick guide to get SpendCheck running locally.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- AWS account (S3)
- OpenAI API key

## Installation Steps

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend-node
npm install @prisma/client @aws-sdk/client-s3 @aws-sdk/s3-request-presigner openai uuid

# Frontend dependencies  
cd ../frontend
npm install react-dropzone lucide-react
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL=postgresql://capexcycle:dev_password@localhost:5432/capexcycle

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=spendcheck-receipts
S3_PRESIGNED_URL_EXPIRY=300

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://spendcheck-receipts --region us-east-1

# Configure CORS
cat > /tmp/s3-cors.json << 'EOF'
{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}
EOF

aws s3api put-bucket-cors \
  --bucket spendcheck-receipts \
  --cors-configuration file:///tmp/s3-cors.json
```

### 4. Run Database Migration

```bash
# Start PostgreSQL
docker-compose up -d

# Wait for database to be ready
sleep 5

# Run SpendCheck migration
psql postgresql://capexcycle:dev_password@localhost:5432/capexcycle \
  -f migrations/015_spendcheck_organizations.sql

# Generate Prisma client
cd backend-node
npx prisma generate
```

### 5. Start Services

```bash
# Terminal 1: Backend
cd backend-node
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

## Verify Installation

### Check Backend

```bash
curl http://localhost:3001/api/organizations
# Should return: []
```

### Check Frontend

Open http://localhost:3000/expenses/new

You should see the receipt upload interface.

### Test Receipt Processing

1. Navigate to http://localhost:3000/expenses/new
2. Upload a receipt image
3. Wait for AI processing (~5 seconds)
4. Review extracted data

## Troubleshooting

### Prisma Client Errors

```bash
cd backend-node
rm -rf node_modules/.prisma
npx prisma generate
```

### S3 Upload Fails

- Check AWS credentials in `.env`
- Verify bucket exists: `aws s3 ls s3://spendcheck-receipts`
- Check CORS configuration: `aws s3api get-bucket-cors --bucket spendcheck-receipts`

### OpenAI API Errors

- Verify API key is valid
- Check account has credits
- Ensure `gpt-4-vision-preview` model access

## Next Steps

- Create test organization via API
- Upload test receipts
- Review AI extraction accuracy
- Test approval workflows

🎉 You're ready to use SpendCheck!
