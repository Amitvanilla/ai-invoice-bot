# Invoice Processing Service

AI-powered invoice parsing, classification, and semantic search service built with FastAPI.

## 🚀 Features

- **AI-Powered Parsing**: Landing AI + Claude + Azure OpenAI pipeline
- **Comprehensive Extraction**: Vendor info, invoice details, line items, taxes, payments
- **Excel Export**: Professional formatted reports
- **Local Storage**: Files saved locally (no AWS required)
- **RESTful API**: Clean endpoints for integration
- **Comprehensive Logging**: Debug information and error tracking

## 🛠️ Setup

### 1. Environment Setup

```bash
# Copy environment template
cp env-template.txt .env

# Edit .env with your API keys
nano .env
```

### 2. Install Dependencies

```bash
# Option 1: Use setup script
python setup.py

# Option 2: Manual installation
pip install -r requirements.txt
```

### 3. Configure API Keys

Update your `.env` file with actual API keys:

```env
# Required API Keys
ANTHROPIC_API_KEY=sk-ant-api03-...
LANDING_AI_API_KEY=your-landing-ai-key
VISION_AGENT_API_KEY=your-vision-agent-key

# Optional (for evaluation/correction)
AZURE_OPENAI_API_KEY=your-azure-key
OPENAI_API_KEY=your-openai-key
```

## 🚀 Running the Service

```bash
# Start the service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080

# Or use the setup script
python setup.py  # Then follow the prompts
```

## 📖 API Documentation

Once running, visit:
- **API Docs**: http://localhost:8080/docs
- **Alternative Docs**: http://localhost:8080/redoc
- **Health Check**: http://localhost:8080/health

## 🔧 API Endpoints

### Process Invoices
```http
POST /parse-invoices
Content-Type: multipart/form-data

# Upload multiple PDF files
curl -X POST -F "pdf_files=@invoice1.pdf" -F "pdf_files=@invoice2.pdf" http://localhost:8080/parse-invoices
```

### Download Results
```http
GET /last-processed-invoices

# Download the latest Excel report
curl http://localhost:8080/last-processed-invoices -o invoice_report.xlsx
```

### Health Check
```http
GET /health
```

## 📁 File Structure

```
invoice-service/
├── exports/           # Generated Excel reports
│   └── user_123/
│       ├── invoice_abc_20241201.xlsx
│       └── invoice_def_20241201.xlsx
├── logs/             # Debug logs and processing info
├── tmp/              # Temporary files during processing
├── app/
│   ├── main.py       # FastAPI application
│   ├── services/     # Business logic
│   └── core/         # Configuration and utilities
├── .env              # Environment variables
└── requirements.txt  # Python dependencies
```

## 🔍 Processing Pipeline

1. **Landing AI**: Extracts raw text and structure from PDFs
2. **Claude**: Converts raw data to structured invoice format
3. **Azure OpenAI**: Validates and corrects the extraction
4. **Excel Export**: Generates professional reports
5. **Local Storage**: Saves files in organized directory structure

## 🧪 Testing

### Test with Sample Invoice
```bash
# Upload a test invoice
curl -X POST \
  -F "pdf_files=@/path/to/your/invoice.pdf" \
  http://localhost:8080/parse-invoices

# Check processing status
curl http://localhost:8080/health

# Download results
curl http://localhost:8080/last-processed-invoices -o results.xlsx
```

### Integration Testing
```python
import requests

# Upload invoice
files = {'pdf_files': open('invoice.pdf', 'rb')}
response = requests.post('http://localhost:8080/parse-invoices', files=files)

# Download Excel
excel_response = requests.get('http://localhost:8080/last-processed-invoices')
with open('invoice_report.xlsx', 'wb') as f:
    f.write(excel_response.content)
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude API key | ✅ |
| `LANDING_AI_API_KEY` | Landing AI API key | ✅ |
| `VISION_AGENT_API_KEY` | Vision Agent API key | ✅ |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | ❌ |
| `OPENAI_API_KEY` | OpenAI API key (fallback) | ❌ |
| `DEBUG` | Enable debug mode | ❌ |
| `PORT` | Service port | ❌ |

### File Size Limits

- **Maximum file size**: 100MB per request
- **Maximum files**: Unlimited (memory dependent)
- **Supported formats**: PDF only

## 🚨 Troubleshooting

### Common Issues

1. **Missing API Keys**
   ```
   Error: anthropic API key not found
   Solution: Update .env file with valid API keys
   ```

2. **Port Already in Use**
   ```
   Error: [Errno 48] Address already in use
   Solution: Change port in .env or kill existing process
   ```

3. **Memory Issues**
   ```
   Error: Out of memory
   Solution: Reduce batch size or increase system memory
   ```

4. **PDF Processing Errors**
   ```
   Error: Could not process PDF
   Solution: Check PDF is not corrupted or password-protected
   ```

### Debug Mode

Enable debug logging:
```env
DEBUG=true
```

Check logs in the `logs/` directory for detailed processing information.

## 📊 Performance

- **Typical processing time**: 30-90 seconds per invoice
- **Memory usage**: ~200MB per concurrent request
- **Excel generation**: ~5-10 seconds for complex invoices

## 🤝 Integration

### Next.js Frontend Integration

```typescript
// Upload invoice from frontend
const uploadInvoice = async (file: File) => {
  const formData = new FormData();
  formData.append('pdf_files', file);

  const response = await fetch('http://localhost:8080/parse-invoices', {
    method: 'POST',
    body: formData
  });

  return response.json();
};
```

### Database Integration

The service can be easily integrated with your existing database by:
1. Storing processing results in your database
2. Adding user authentication
3. Implementing file management features

## 📝 License

This project is part of the invoice processing system. See main project for license information.

## 🆘 Support

For issues and questions:
1. Check the logs in the `logs/` directory
2. Verify API keys in `.env` file
3. Test with the health endpoint
4. Review the API documentation at `/docs`
