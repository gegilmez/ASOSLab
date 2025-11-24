# Deployment Guide - Real Estate Property Analyzer

## Overview
This application is designed to run in both development (local MongoDB) and production (MongoDB Atlas) environments with robust error handling.

## Environment Configuration

### Required Environment Variables

#### Backend (.env)
```bash
# Database Configuration
MONGO_URL="mongodb://localhost:27017"  # Development
# MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority"  # Production

DB_NAME="real_estate_db"

# API Keys
RAPIDAPI_KEY="your_rapidapi_key_here"
RAPIDAPI_HOST="zillow-com1.p.rapidapi.com"

# Email Configuration
GMAIL_ADDRESS="your_gmail@gmail.com"
GMAIL_APP_PASSWORD="your_app_password"
SMTP_SERVER="smtp.gmail.com"
SMTP_PORT="587"

# Google Sheets
GOOGLE_SHEET_ID="your_google_sheet_id"
GOOGLE_CREDENTIALS_PATH="/app/backend/google_credentials.json"

# CORS
CORS_ORIGINS="*"
```

#### Frontend (.env)
```bash
REACT_APP_BACKEND_URL="http://localhost:8001"  # Development
# REACT_APP_BACKEND_URL="https://your-production-domain.com"  # Production
```

## Deployment Options

### Option 1: With MongoDB Atlas (Recommended for Production)

1. **Create MongoDB Atlas Cluster**
   - Sign up at https://www.mongodb.com/cloud/atlas
   - Create a new cluster (free tier available)
   - Create a database user with read/write permissions
   - Whitelist your application's IP address (or use 0.0.0.0/0 for testing)

2. **Get Connection String**
   - In Atlas, click "Connect" → "Connect your application"
   - Copy the connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/`)
   - Replace `<password>` with your actual password

3. **Configure Environment**
   - Set `MONGO_URL` environment variable to your Atlas connection string
   - The application will automatically use this connection

4. **Deploy**
   - Push your code to your hosting platform
   - Set environment variables in your platform's configuration
   - The app will connect to Atlas on startup

### Option 2: Without MongoDB (Degraded Mode)

The application can run without MongoDB with limited functionality:
- ✅ Property search works (results are not saved)
- ✅ Financial calculations work
- ✅ Google Sheets export works
- ✅ Email sending works
- ❌ Cannot save properties to database
- ❌ Cannot retrieve saved properties
- ❌ Cannot edit saved properties
- ❌ Email preferences not saved

To run without MongoDB:
1. Don't set `MONGO_URL` environment variable (or set it to an invalid value)
2. The app will start with warnings but continue to function
3. Check `/api/health` endpoint to verify degraded status

## Health Check

The application provides a health check endpoint at `/api/health`:

```bash
curl https://your-domain.com/api/health
```

Response examples:

**Healthy (All services working):**
```json
{
  "status": "healthy",
  "services": {
    "mongodb": "connected",
    "config": "ok"
  }
}
```

**Degraded (MongoDB unavailable):**
```json
{
  "status": "degraded",
  "services": {
    "mongodb": "not_configured",
    "config": "ok"
  }
}
```

## Troubleshooting

### MongoDB Connection Issues

**Error: "not authorized on real_estate_db"**
- Cause: Invalid credentials or database permissions
- Fix: Verify username/password in connection string and check user permissions in Atlas

**Error: "ServerSelectionTimeoutError"**
- Cause: Cannot reach MongoDB server
- Fix: Check IP whitelist in Atlas, verify network connectivity

**Error: "Database not available" in logs**
- Cause: `MONGO_URL` not set or invalid
- Fix: Set correct `MONGO_URL` environment variable

### API Key Issues

**Error: "missing: RAPIDAPI_KEY"**
- Fix: Set `RAPIDAPI_KEY` environment variable

**Google Sheets errors**
- Verify `GOOGLE_CREDENTIALS_PATH` points to valid service account JSON
- Ensure service account has editor access to the target spreadsheet

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| MongoDB | Local (`localhost:27017`) | Atlas (Cloud) |
| Backend URL | `http://localhost:8001` | `https://your-domain.com` |
| CORS | `*` (all origins) | Specific domains |
| Logging | INFO level | INFO/ERROR level |

## Monitoring

Monitor application health:
1. Check `/api/health` endpoint regularly
2. Monitor backend logs for MongoDB warnings
3. Set up alerts for "degraded" status responses

## Security Notes

1. **Never commit `.env` files** - Use environment variables or secrets management
2. **Rotate API keys regularly**
3. **Use specific CORS origins** in production (not `*`)
4. **Keep MongoDB Atlas IP whitelist minimal**
5. **Use strong passwords** for MongoDB users
6. **Store Google credentials securely** - Use secrets management in production

## Rollback Plan

If deployment fails:
1. Check `/api/health` endpoint
2. Review backend logs for MongoDB errors
3. Verify all environment variables are set correctly
4. Roll back to previous version if needed
5. The app will continue to work in degraded mode if MongoDB is unavailable

## Support

For deployment issues:
1. Check the health endpoint first
2. Review logs for specific error messages
3. Verify all environment variables are correctly set
4. Test MongoDB connection separately if needed
