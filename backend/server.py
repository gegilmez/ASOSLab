from fastapi import FastAPI, APIRouter, HTTPException, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import httpx
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Real Estate Property Analyzer")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enums
class PropertyType(str, Enum):
    SINGLE_FAMILY = "single_family"
    MULTI_FAMILY = "multi_family"
    CONDO = "condo"
    TOWNHOUSE = "townhouse"

class PropertyCondition(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    NEEDS_TLC = "needs_tlc"
    UNKNOWN = "unknown"

# Models
class PropertyListing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    zpid: str = Field(..., description="Zillow Property ID")
    address: str
    city: str
    state: str = "MO"
    zip_code: str
    price: float = Field(..., gt=0)
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    sqft: Optional[int] = None
    lot_size: Optional[str] = None
    property_type: PropertyType
    property_condition: PropertyCondition = PropertyCondition.UNKNOWN
    year_built: Optional[int] = None
    url: Optional[str] = None
    
    # New property features
    has_garage: Optional[bool] = None
    garage_spaces: Optional[int] = None
    nearby_vacant_properties: Optional[int] = 0
    nearby_damaged_properties: Optional[int] = 0
    neighborhood_quality: Optional[str] = "good"  # excellent, good, fair, poor
    
    # Analysis fields
    monthly_rent: Optional[float] = None
    property_tax: Optional[float] = None
    insurance: Optional[float] = None
    vacancy_rate: float = 0.04
    
    # Calculated fields
    cap_rate: Optional[float] = None
    roi: Optional[float] = None
    annual_cash_flow: Optional[float] = None
    noi: Optional[float] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PropertyAnalysis(BaseModel):
    # Input values
    purchase_price: float
    monthly_rent: float
    vacancy_rate: float = 0.04
    property_tax_annual: float
    insurance_annual: float
    utilities_annual: float = 500
    lawn_snow_annual: float = 0
    property_mgmt_rate: float = 0.0
    repair_rate: float = 0.10
    maintenance_rate: float = 0.03
    
    # Financing
    down_payment_pct: float = 0.20
    interest_rate: float = 0.07
    loan_term_years: int = 30
    
    # Calculated outputs
    annual_gross_rent: Optional[float] = None
    annual_vacancy_loss: Optional[float] = None
    effective_gross_income: Optional[float] = None
    total_operating_expenses: Optional[float] = None
    noi: Optional[float] = None
    annual_debt_service: Optional[float] = None
    annual_cash_flow: Optional[float] = None
    cap_rate: Optional[float] = None
    cash_on_cash_roi: Optional[float] = None

class SearchFilters(BaseModel):
    cities: List[str] = Field(default=["Florissant", "St. Ann", "Maryland Heights", "University City", "Lemay", "Afton"])
    min_price: float = 0
    max_price: float = 500000
    min_bedrooms: Optional[int] = None
    max_bedrooms: Optional[int] = None
    property_types: List[PropertyType] = Field(default=[PropertyType.SINGLE_FAMILY, PropertyType.MULTI_FAMILY])
    min_cap_rate: Optional[float] = None
    requires_garage: bool = True
    max_nearby_vacant_days: int = 100
    exclude_damaged_nearby: bool = True
    limit: int = Field(default=50, le=100)

class EmailPreferences(BaseModel):
    email: str
    min_cap_rate: float = 0.05
    min_roi: float = 0.08
    day_of_week: str = "monday"
    enabled: bool = True

# Service Functions
async def estimate_property_values(prop: dict) -> dict:
    """Estimate missing property values using St. Louis averages"""
    
    # Estimate monthly rent based on bedrooms
    if not prop.get('monthly_rent'):
        bedrooms = prop.get('bedrooms', 2)
        if bedrooms == 2:
            prop['monthly_rent'] = 1200
        elif bedrooms == 3:
            prop['monthly_rent'] = 1500
        elif bedrooms >= 4:
            prop['monthly_rent'] = 1800
        else:
            prop['monthly_rent'] = 1000
    
    # Estimate property tax (1.8% of purchase price annually)
    if not prop.get('property_tax'):
        prop['property_tax'] = prop['price'] * 0.018
    
    # Estimate insurance ($1000/year base)
    if not prop.get('insurance'):
        prop['insurance'] = 1000
    
    return prop

async def calculate_property_analysis(prop: dict, purchase_price: float) -> PropertyAnalysis:
    """Calculate cap rate and ROI using spreadsheet formulas"""
    
    analysis = PropertyAnalysis(
        purchase_price=purchase_price,
        monthly_rent=prop.get('monthly_rent', 1500),
        property_tax_annual=prop.get('property_tax', purchase_price * 0.018),
        insurance_annual=prop.get('insurance', 1000)
    )
    
    # Calculate Annual Gross Rent Revenue
    analysis.annual_gross_rent = analysis.monthly_rent * 12
    
    # Calculate Annual Vacancy Loss
    analysis.annual_vacancy_loss = analysis.annual_gross_rent * analysis.vacancy_rate
    
    # Calculate Effective Gross Income (EGI)
    analysis.effective_gross_income = analysis.annual_gross_rent - analysis.annual_vacancy_loss
    
    # Calculate Operating Expenses
    repair_expense = analysis.effective_gross_income * analysis.repair_rate
    maintenance_expense = analysis.effective_gross_income * analysis.maintenance_rate
    property_mgmt = analysis.effective_gross_income * analysis.property_mgmt_rate
    
    analysis.total_operating_expenses = (
        analysis.property_tax_annual +
        analysis.insurance_annual +
        analysis.utilities_annual +
        analysis.lawn_snow_annual +
        repair_expense +
        maintenance_expense +
        property_mgmt
    )
    
    # Calculate Net Operating Income (NOI)
    analysis.noi = analysis.effective_gross_income - analysis.total_operating_expenses
    
    # Calculate Cap Rate
    analysis.cap_rate = (analysis.noi / analysis.purchase_price) * 100 if analysis.purchase_price > 0 else 0
    
    # Calculate Debt Service
    mortgage_amount = analysis.purchase_price * (1 - analysis.down_payment_pct)
    monthly_rate = analysis.interest_rate / 12
    num_payments = analysis.loan_term_years * 12
    
    if mortgage_amount > 0 and monthly_rate > 0:
        monthly_payment = mortgage_amount * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)
        analysis.annual_debt_service = monthly_payment * 12
    else:
        analysis.annual_debt_service = 0
    
    # Calculate Annual Cash Flow
    analysis.annual_cash_flow = analysis.noi - analysis.annual_debt_service
    
    # Calculate Cash on Cash ROI
    capital_required = analysis.purchase_price * analysis.down_payment_pct
    analysis.cash_on_cash_roi = (analysis.annual_cash_flow / capital_required) * 100 if capital_required > 0 else 0
    
    return analysis

async def search_zillow_properties(filters: SearchFilters) -> List[dict]:
    """Search properties using RapidAPI Zillow endpoint"""
    
    rapidapi_key = os.environ.get('RAPIDAPI_KEY')
    rapidapi_host = os.environ.get('RAPIDAPI_HOST')
    
    if not rapidapi_key:
        logger.warning("RapidAPI key not found, using mock data")
        return get_mock_properties(filters)
    
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": rapidapi_host
    }
    
    all_properties = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for city in filters.cities:
            try:
                url = "https://zillow-com1.p.rapidapi.com/propertyExtendedSearch"
                params = {
                    "location": f"{city}, MO",
                    "status_type": "ForSale",
                    "home_type": "Houses"
                }
                
                response = await client.get(url, headers=headers, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    props = data.get('props', [])
                    all_properties.extend(props)
                    logger.info(f"Found {len(props)} properties in {city}")
                else:
                    logger.warning(f"API returned status {response.status_code} for {city}")
                    
            except Exception as e:
                logger.error(f"Error searching {city}: {str(e)}")
                continue
    
    # If no results from API, return mock data
    if not all_properties:
        logger.info("No results from API, using mock data")
        return get_mock_properties(filters)
    
    return all_properties

def get_mock_properties(filters: SearchFilters) -> List[dict]:
    """Generate mock property data for testing"""
    mock_props = [
        {
            "zpid": "2076622826",
            "address": "130 Ruth Dr",
            "city": "Florissant",
            "state": "MO",
            "zipcode": "63031",
            "price": 155000,
            "bedrooms": 3,
            "bathrooms": 2,
            "livingArea": 912,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 2,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "url": "https://www.zillow.com/homedetails/130-Ruth-Dr-Florissant-MO-63031/2076622826_zpid/"
        },
        {
            "zpid": "2987123456",
            "address": "456 Oak Street",
            "city": "Maryland Heights",
            "state": "MO",
            "zipcode": "63043",
            "price": 135000,
            "bedrooms": 2,
            "bathrooms": 1.5,
            "livingArea": 1100,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 1,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "excellent",
            "url": "https://www.zillow.com/homedetails/456-Oak-Street-Maryland-Heights-MO-63043/2987123456_zpid/"
        },
        {
            "zpid": "3456789012",
            "address": "789 Maple Ave",
            "city": "University City",
            "state": "MO",
            "zipcode": "63130",
            "price": 245000,
            "bedrooms": 4,
            "bathrooms": 2,
            "livingArea": 1600,
            "homeType": "MULTI_FAMILY",
            "propertyType": "multi_family",
            "has_garage": True,
            "garage_spaces": 2,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "url": "https://www.zillow.com/homedetails/789-Maple-Ave-University-City-MO-63130/3456789012_zpid/"
        },
        {
            "zpid": "4567890123",
            "address": "321 Pine Blvd",
            "city": "St. Ann",
            "state": "MO",
            "zipcode": "63074",
            "price": 142000,
            "bedrooms": 3,
            "bathrooms": 2,
            "livingArea": 1250,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 2,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "url": "https://www.zillow.com/homedetails/321-Pine-Blvd-St-Ann-MO-63074/4567890123_zpid/"
        },
        {
            "zpid": "5678901234",
            "address": "555 Cedar Lane",
            "city": "Lemay",
            "state": "MO",
            "zipcode": "63125",
            "price": 128000,
            "bedrooms": 2,
            "bathrooms": 1,
            "livingArea": 950,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": False,
            "garage_spaces": 0,
            "nearby_vacant_properties": 1,
            "nearby_damaged_properties": 1,
            "neighborhood_quality": "fair",
            "url": "https://www.zillow.com/homedetails/555-Cedar-Lane-Lemay-MO-63125/5678901234_zpid/"
        },
        {
            "zpid": "6789012345",
            "address": "888 Elm Street",
            "city": "Afton",
            "state": "MO",
            "zipcode": "63123",
            "price": 139000,
            "bedrooms": 3,
            "bathrooms": 1.5,
            "livingArea": 1150,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 1,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "url": "https://www.zillow.com/homedetails/888-Elm-Street-Afton-MO-63123/6789012345_zpid/"
        }
    ]
    return mock_props

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Real Estate Property Analyzer API", "version": "1.0.0"}

@api_router.post("/properties/search", response_model=List[PropertyListing])
async def search_properties(filters: SearchFilters):
    """Search and analyze properties based on filters"""
    try:
        # Search properties
        raw_properties = await search_zillow_properties(filters)
        
        analyzed_properties = []
        
        for prop in raw_properties:
            try:
                # Parse property data
                property_data = {
                    'zpid': str(prop.get('zpid', '')),
                    'address': prop.get('address', ''),
                    'city': prop.get('city', ''),
                    'state': prop.get('state', 'MO'),
                    'zip_code': prop.get('zipcode', ''),
                    'price': float(prop.get('price', 0)),
                    'bedrooms': prop.get('bedrooms'),
                    'bathrooms': prop.get('bathrooms'),
                    'sqft': prop.get('livingArea'),
                    'property_type': PropertyType.SINGLE_FAMILY if 'SINGLE' in str(prop.get('homeType', '')).upper() else PropertyType.MULTI_FAMILY,
                    'property_condition': PropertyCondition.NEEDS_TLC,
                    'url': prop.get('url', ''),
                    'has_garage': prop.get('has_garage', True),  # Assume yes if not specified
                    'garage_spaces': prop.get('garage_spaces', 1),
                    'nearby_vacant_properties': prop.get('nearby_vacant_properties', 0),
                    'nearby_damaged_properties': prop.get('nearby_damaged_properties', 0),
                    'neighborhood_quality': prop.get('neighborhood_quality', 'good')
                }
                
                # Apply price filters
                if property_data['price'] < filters.min_price or property_data['price'] > filters.max_price:
                    continue
                
                # Apply bedroom filters
                if filters.min_bedrooms and property_data['bedrooms']:
                    if property_data['bedrooms'] < filters.min_bedrooms:
                        continue
                if filters.max_bedrooms and property_data['bedrooms']:
                    if property_data['bedrooms'] > filters.max_bedrooms:
                        continue
                
                # Estimate missing values
                property_data = await estimate_property_values(property_data)
                
                # Calculate analysis
                analysis = await calculate_property_analysis(property_data, property_data['price'])
                
                # Add calculated fields
                property_data['cap_rate'] = round(analysis.cap_rate, 2)
                property_data['roi'] = round(analysis.cash_on_cash_roi, 2)
                property_data['annual_cash_flow'] = round(analysis.annual_cash_flow, 2)
                property_data['noi'] = round(analysis.noi, 2)
                property_data['monthly_rent'] = property_data.get('monthly_rent')
                property_data['property_tax'] = property_data.get('property_tax')
                property_data['insurance'] = property_data.get('insurance')
                
                # Apply cap rate filter
                if filters.min_cap_rate and property_data['cap_rate'] < filters.min_cap_rate:
                    continue
                
                listing = PropertyListing(**property_data)
                analyzed_properties.append(listing)
                
                # Save to database
                await db.properties.update_one(
                    {"zpid": listing.zpid},
                    {"$set": listing.model_dump()},
                    upsert=True
                )
                
            except Exception as e:
                logger.error(f"Error processing property: {str(e)}")
                continue
        
        # Sort by cap rate descending
        analyzed_properties.sort(key=lambda x: x.cap_rate or 0, reverse=True)
        
        return analyzed_properties[:filters.limit]
        
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/properties", response_model=List[PropertyListing])
async def get_saved_properties(limit: int = Query(50, le=200)):
    """Get saved properties from database"""
    try:
        properties = await db.properties.find({}, {"_id": 0}).sort("cap_rate", -1).to_list(limit)
        return [PropertyListing(**prop) for prop in properties]
    except Exception as e:
        logger.error(f"Error fetching properties: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/properties/{zpid}", response_model=PropertyListing)
async def get_property_details(zpid: str):
    """Get specific property details"""
    try:
        prop = await db.properties.find_one({"zpid": zpid}, {"_id": 0})
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        return PropertyListing(**prop)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching property: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/email-preferences")
async def save_email_preferences(prefs: EmailPreferences):
    """Save email notification preferences"""
    try:
        await db.email_prefs.update_one(
            {"email": prefs.email},
            {"$set": prefs.model_dump()},
            upsert=True
        )
        return {"message": "Email preferences saved successfully"}
    except Exception as e:
        logger.error(f"Error saving preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/email-preferences/{email}")
async def get_email_preferences(email: str):
    """Get email preferences"""
    try:
        prefs = await db.email_prefs.find_one({"email": email}, {"_id": 0})
        if not prefs:
            return EmailPreferences(email=email)
        return EmailPreferences(**prefs)
    except Exception as e:
        logger.error(f"Error fetching preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def send_weekly_email():
    """Send weekly property email to subscribed users"""
    try:
        logger.info("Starting weekly email job")
        
        # Get all active email preferences
        prefs_list = await db.email_prefs.find({"enabled": True}).to_list(100)
        
        if not prefs_list:
            logger.info("No active email subscriptions")
            return
        
        for prefs_dict in prefs_list:
            try:
                prefs = EmailPreferences(**prefs_dict)
                
                # Get properties matching criteria
                properties = await db.properties.find(
                    {
                        "cap_rate": {"$gte": prefs.min_cap_rate * 100},
                        "roi": {"$gte": prefs.min_roi * 100}
                    },
                    {"_id": 0}
                ).sort("cap_rate", -1).limit(10).to_list(10)
                
                if not properties:
                    logger.info(f"No matching properties for {prefs.email}")
                    continue
                
                # Build email HTML
                html_content = f"""
                <html>
                  <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Your Weekly St. Louis Property Report</h2>
                    <p>Here are the top investment properties that match your criteria:</p>
                    <p><strong>Criteria:</strong> Cap Rate ≥ {prefs.min_cap_rate*100}%, ROI ≥ {prefs.min_roi*100}%</p>
                    <hr/>
                """
                
                for prop_dict in properties:
                    prop = PropertyListing(**prop_dict)
                    html_content += f"""
                    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; background: #f9fafb;">
                      <h3 style="margin-top: 0; color: #1f2937;">{prop.address}, {prop.city}</h3>
                      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <div><strong>Price:</strong> ${prop.price:,.0f}</div>
                        <div><strong>Bedrooms:</strong> {prop.bedrooms or 'N/A'}</div>
                        <div><strong>Cap Rate:</strong> <span style="color: #059669; font-weight: bold;">{prop.cap_rate:.2f}%</span></div>
                        <div><strong>ROI:</strong> <span style="color: #059669; font-weight: bold;">{prop.roi:.2f}%</span></div>
                        <div><strong>Cash Flow:</strong> ${prop.annual_cash_flow:,.0f}/year</div>
                        <div><strong>Est. Rent:</strong> ${prop.monthly_rent:,.0f}/month</div>
                      </div>
                      <a href="{prop.url}" style="display: inline-block; margin-top: 12px; padding: 8px 16px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px;">View on Zillow</a>
                    </div>
                    """
                
                html_content += """
                  </body>
                </html>
                """
                
                # Send email
                message = MIMEMultipart('alternative')
                message['Subject'] = f"Weekly St. Louis Property Report - {len(properties)} Properties Found"
                message['From'] = os.environ.get('GMAIL_ADDRESS')
                message['To'] = prefs.email
                
                html_part = MIMEText(html_content, 'html')
                message.attach(html_part)
                
                await aiosmtplib.send(
                    message,
                    hostname=os.environ.get('SMTP_SERVER', 'smtp.gmail.com'),
                    port=int(os.environ.get('SMTP_PORT', 587)),
                    username=os.environ.get('GMAIL_ADDRESS'),
                    password=os.environ.get('GMAIL_APP_PASSWORD').replace(' ', ''),
                    start_tls=True
                )
                
                logger.info(f"Email sent successfully to {prefs.email}")
                
            except Exception as e:
                logger.error(f"Error sending email to {prefs.email}: {str(e)}")
                continue
        
        logger.info("Weekly email job completed")
        
    except Exception as e:
        logger.error(f"Error in weekly email job: {str(e)}")

@api_router.post("/test-email")
async def test_email_send(email: str):
    """Test email sending functionality"""
    try:
        message = MIMEMultipart('alternative')
        message['Subject'] = "Test Email - Real Estate Analyzer"
        message['From'] = os.environ.get('GMAIL_ADDRESS')
        message['To'] = email
        
        html = """
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2>Test Email</h2>
            <p>If you're reading this, email notifications are working correctly!</p>
          </body>
        </html>
        """
        
        message.attach(MIMEText(html, 'html'))
        
        await aiosmtplib.send(
            message,
            hostname=os.environ.get('SMTP_SERVER', 'smtp.gmail.com'),
            port=int(os.environ.get('SMTP_PORT', 587)),
            username=os.environ.get('GMAIL_ADDRESS'),
            password=os.environ.get('GMAIL_APP_PASSWORD').replace(' ', ''),
            start_tls=True
        )
        
        return {"message": f"Test email sent successfully to {email}"}
    except Exception as e:
        logger.error(f"Error sending test email: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Scheduler setup
scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup_event():
    # Schedule weekly email every Monday at 9 AM
    scheduler.add_job(
        send_weekly_email,
        CronTrigger(day_of_week='mon', hour=9, minute=0),
        id='weekly_email',
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started - Weekly emails will be sent every Monday at 9 AM")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    client.close()

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)