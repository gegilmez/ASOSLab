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
from city_updater import get_cached_cities, fetch_cities_from_sheet
import gspread
from oauth2client.service_account import ServiceAccountCredentials

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

class HomeStyle(str, Enum):
    RANCH = "ranch"
    COLONIAL = "colonial"
    VICTORIAN = "victorian"
    BUNGALOW = "bungalow"
    CAPE_COD = "cape_cod"
    SPLIT_LEVEL = "split_level"
    CONTEMPORARY = "contemporary"
    TUDOR = "tudor"
    CRAFTSMAN = "craftsman"
    OTHER = "other"

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
    home_style: Optional[HomeStyle] = HomeStyle.OTHER
    days_on_market: Optional[int] = 0
    
    # RECA contamination zone data
    in_reca_zone: Optional[bool] = False
    reca_zip_codes: List[str] = ["63031", "63033", "63034", "63042", "63043", "63044", "63045", "63074", "63114", "63121", "63134", "63135", "63138", "63140", "63145"]
    proximity_to_coldwater_creek: Optional[str] = None  # "immediate", "near", "moderate", "far"
    proximity_to_westlake_landfill: Optional[str] = None  # "immediate", "near", "moderate", "far"
    contamination_notes: Optional[str] = None
    
    # Analysis fields
    monthly_rent: Optional[float] = None
    property_tax: Optional[float] = None
    insurance: Optional[float] = 1000
    vacancy_rate: float = 0.04
    deferred_maintenance: Optional[float] = 5000
    closing_cost_rate: float = 0.08
    interest_rate: float = 0.07
    down_payment_pct: float = 0.20
    
    # Calculated fields
    cap_rate: Optional[float] = None
    roi: Optional[float] = None
    annual_cash_flow: Optional[float] = None
    noi: Optional[float] = None
    irr: Optional[float] = None  # Internal Rate of Return
    
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
    cities: List[str] = Field(default=["St. Louis City", "University City", "Clayton"])
    min_price: float = 0
    max_price: float = 500000
    min_bedrooms: Optional[int] = None
    max_bedrooms: Optional[int] = None
    property_types: List[PropertyType] = Field(default=[PropertyType.SINGLE_FAMILY, PropertyType.MULTI_FAMILY])
    home_styles: Optional[List[HomeStyle]] = None
    min_cap_rate: Optional[float] = None
    requires_garage: bool = True
    max_nearby_vacant_days: int = 100
    exclude_damaged_nearby: bool = True
    min_days_on_market: int = 0
    limit: int = Field(default=50, le=100)

class EmailPreferences(BaseModel):
    email: str
    min_cap_rate: float = 0.07
    min_roi: float = 0.08
    min_irr: float = 0.10
    frequency: str = "weekly"  # daily, weekly, biweekly, monthly
    day_of_week: str = "monday"
    enabled: bool = True

# Service Functions
def assess_contamination_risk(prop: dict) -> dict:
    """Assess RECA contamination zone status and proximity to contamination sites"""
    
    # RECA impacted ZIP codes
    reca_zips = ["63031", "63033", "63034", "63042", "63043", "63044", "63045", 
                 "63074", "63114", "63121", "63134", "63135", "63138", "63140", "63145"]
    
    # RECA impacted cities/neighborhoods
    reca_areas = ["Berkeley", "Black Jack", "Bridgeton", "Ferguson", "Florissant", 
                  "Hazelwood", "Maryland Heights", "Overland", "St. Ann", "Saint Ann"]
    
    zip_code = str(prop.get('zip_code', ''))
    city = prop.get('city', '').lower()
    
    # Check if in RECA zone
    prop['in_reca_zone'] = zip_code in reca_zips or any(area.lower() in city for area in reca_areas)
    
    # Estimate proximity based on city/zip
    # Immediate proximity cities (right next to contamination sites)
    immediate_cities = ["bridgeton", "hazelwood", "berkeley", "ferguson"]
    near_cities = ["florissant", "maryland heights", "overland", "st. ann", "saint ann"]
    
    if any(city_name in city for city_name in immediate_cities):
        prop['proximity_to_coldwater_creek'] = "immediate"
        prop['proximity_to_westlake_landfill'] = "immediate" if "bridgeton" in city or "hazelwood" in city else "near"
    elif any(city_name in city for city_name in near_cities):
        prop['proximity_to_coldwater_creek'] = "near"
        prop['proximity_to_westlake_landfill'] = "moderate"
    elif prop['in_reca_zone']:
        prop['proximity_to_coldwater_creek'] = "moderate"
        prop['proximity_to_westlake_landfill'] = "moderate"
    else:
        prop['proximity_to_coldwater_creek'] = "far"
        prop['proximity_to_westlake_landfill'] = "far"
    
    # Add contamination notes
    if prop['in_reca_zone']:
        sites = []
        if prop['proximity_to_coldwater_creek'] in ["immediate", "near"]:
            sites.append("Cold Water Creek")
        if prop['proximity_to_westlake_landfill'] in ["immediate", "near"]:
            sites.append("West Lake Landfill")
        
        if sites:
            prop['contamination_notes'] = f"RECA impacted area. Near: {', '.join(sites)}"
        else:
            prop['contamination_notes'] = "RECA impacted area"
    else:
        prop['contamination_notes'] = None
    
    return prop

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

def calculate_irr(cash_flows: List[float], initial_investment: float, years: int = 10) -> float:
    """Calculate Internal Rate of Return using Newton's method"""
    import numpy as np
    
    # Build cash flow array with initial investment as negative
    cf_array = [-initial_investment] + cash_flows
    
    try:
        # Use numpy's IRR calculation (approximation)
        irr = np.irr(cf_array)
        return irr * 100 if not np.isnan(irr) else 0.0
    except:
        # Fallback to simple approximation
        total_cash_flows = sum(cash_flows)
        if initial_investment > 0:
            return (total_cash_flows / initial_investment / years) * 100
        return 0.0

async def calculate_property_analysis(prop: dict, purchase_price: float) -> PropertyAnalysis:
    """Calculate cap rate and ROI using spreadsheet formulas"""
    
    analysis = PropertyAnalysis(
        purchase_price=purchase_price,
        monthly_rent=prop.get('monthly_rent', 1500),
        property_tax_annual=prop.get('property_tax', purchase_price * 0.018),
        insurance_annual=prop.get('insurance', 1000),
        down_payment_pct=prop.get('down_payment_pct', 0.20),
        interest_rate=prop.get('interest_rate', 0.07)
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
            "city": "St. Louis City",
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
            "home_style": "ranch",
            "days_on_market": 15,
            "in_reca_zone": True,
            "proximity_to_coldwater_creek": "near",
            "proximity_to_westlake_landfill": "moderate",
            "url": "https://www.zillow.com/homedetails/130-Ruth-Dr-St-Louis-City-MO-63031/2076622826_zpid/"
        },
        {
            "zpid": "2987123456",
            "address": "456 Oak Street",
            "city": "Clayton",
            "state": "MO",
            "zipcode": "63043",
            "price": 235000,
            "bedrooms": 3,
            "bathrooms": 2.5,
            "livingArea": 1800,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 2,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "excellent",
            "home_style": "colonial",
            "days_on_market": 25,
            "url": "https://www.zillow.com/homedetails/456-Oak-Street-Clayton-MO-63043/2987123456_zpid/"
        },
        {
            "zpid": "3456789012",
            "address": "789 Maple Ave",
            "city": "The Hill",
            "state": "MO",
            "zipcode": "63130",
            "price": 175000,
            "bedrooms": 3,
            "bathrooms": 2,
            "livingArea": 1400,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 1,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "home_style": "bungalow",
            "days_on_market": 5,
            "url": "https://www.zillow.com/homedetails/789-Maple-Ave-The-Hill-MO-63130/3456789012_zpid/"
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
            "home_style": "ranch",
            "days_on_market": 30,
            "url": "https://www.zillow.com/homedetails/321-Pine-Blvd-St-Ann-MO-63074/4567890123_zpid/"
        },
        {
            "zpid": "5678901234",
            "address": "555 Cedar Lane",
            "city": "Lemay",
            "state": "MO",
            "zipcode": "63125",
            "price": 138000,
            "bedrooms": 2,
            "bathrooms": 1.5,
            "livingArea": 1050,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 1,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "home_style": "ranch",
            "days_on_market": 8,
            "url": "https://www.zillow.com/homedetails/555-Cedar-Lane-Lemay-MO-63125/5678901234_zpid/"
        },
        {
            "zpid": "6789012345",
            "address": "888 Elm Street",
            "city": "Affton",
            "state": "MO",
            "zipcode": "63123",
            "price": 149000,
            "bedrooms": 3,
            "bathrooms": 2,
            "livingArea": 1300,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 2,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "home_style": "split_level",
            "days_on_market": 12,
            "url": "https://www.zillow.com/homedetails/888-Elm-Street-Affton-MO-63123/6789012345_zpid/"
        },
        {
            "zpid": "7890123456",
            "address": "123 Walnut Ave",
            "city": "Bella Villa",
            "state": "MO",
            "zipcode": "63125",
            "price": 132000,
            "bedrooms": 2,
            "bathrooms": 1,
            "livingArea": 1000,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 1,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "fair",
            "home_style": "ranch",
            "days_on_market": 45,
            "url": "https://www.zillow.com/homedetails/123-Walnut-Ave-Bella-Villa-MO-63125/7890123456_zpid/"
        },
        {
            "zpid": "8901234567",
            "address": "456 Magnolia Dr",
            "city": "Florissant",
            "state": "MO",
            "zipcode": "63031",
            "price": 145000,
            "bedrooms": 3,
            "bathrooms": 1.5,
            "livingArea": 1200,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 2,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "home_style": "ranch",
            "days_on_market": 20,
            "url": "https://www.zillow.com/homedetails/456-Magnolia-Dr-Florissant-MO-63031/8901234567_zpid/"
        },
        {
            "zpid": "9012345678",
            "address": "890 Chestnut Dr",
            "city": "Brentwood",
            "state": "MO",
            "zipcode": "63042",
            "price": 215000,
            "bedrooms": 3,
            "bathrooms": 2,
            "livingArea": 1550,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 2,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "excellent",
            "home_style": "contemporary",
            "days_on_market": 7,
            "url": "https://www.zillow.com/homedetails/890-Chestnut-Dr-Brentwood-MO-63042/9012345678_zpid/"
        },
        {
            "zpid": "0123456789",
            "address": "123 Poplar Ln",
            "city": "Maplewood",
            "state": "MO",
            "zipcode": "63301",
            "price": 189000,
            "bedrooms": 3,
            "bathrooms": 2,
            "livingArea": 1450,
            "homeType": "SINGLE_FAMILY",
            "propertyType": "single_family",
            "has_garage": True,
            "garage_spaces": 2,
            "nearby_vacant_properties": 0,
            "nearby_damaged_properties": 0,
            "neighborhood_quality": "good",
            "home_style": "craftsman",
            "days_on_market": 18,
            "url": "https://www.zillow.com/homedetails/123-Poplar-Ln-Maplewood-MO-63301/0123456789_zpid/"
        }
    ]
    return mock_props

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Real Estate Property Analyzer API", "version": "1.0.0"}

@api_router.get("/cities")
async def get_cities(force_refresh: bool = False):
    """Get active cities from spreadsheet (cached for 1 week)"""
    try:
        cities = await get_cached_cities(force_refresh=force_refresh)
        return {"cities": cities, "count": len(cities)}
    except Exception as e:
        logger.error(f"Error getting cities: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
                zpid = str(prop.get('zpid', ''))
                address = prop.get('address', '')
                city = prop.get('city', '')
                state = prop.get('state', 'MO')
                zipcode = prop.get('zipcode', '')
                
                # Get URL from API or generate fallback Zillow URL
                zillow_url = prop.get('url', '')
                if not zillow_url and zpid:
                    # Generate Zillow URL from property details
                    # Format: https://www.zillow.com/homedetails/ADDRESS-CITY-STATE-ZIP/ZPID_zpid/
                    address_slug = address.replace(' ', '-').replace(',', '')
                    city_slug = city.replace(' ', '-')
                    zillow_url = f"https://www.zillow.com/homedetails/{address_slug}-{city_slug}-{state}-{zipcode}/{zpid}_zpid/"
                
                property_data = {
                    'zpid': zpid,
                    'address': address,
                    'city': city,
                    'state': state,
                    'zip_code': zipcode,
                    'price': float(prop.get('price', 0)),
                    'bedrooms': prop.get('bedrooms'),
                    'bathrooms': prop.get('bathrooms'),
                    'sqft': prop.get('livingArea'),
                    'property_type': PropertyType.SINGLE_FAMILY if 'SINGLE' in str(prop.get('homeType', '')).upper() else PropertyType.MULTI_FAMILY,
                    'property_condition': PropertyCondition.NEEDS_TLC,
                    'url': zillow_url,
                    'has_garage': prop.get('has_garage', True),
                    'garage_spaces': prop.get('garage_spaces', 1),
                    'nearby_vacant_properties': prop.get('nearby_vacant_properties', 0),
                    'nearby_damaged_properties': prop.get('nearby_damaged_properties', 0),
                    'neighborhood_quality': prop.get('neighborhood_quality', 'good'),
                    'home_style': prop.get('home_style', HomeStyle.OTHER),
                    'insurance': prop.get('insurance', 1000),
                    'deferred_maintenance': prop.get('deferred_maintenance', 5000),
                    'closing_cost_rate': prop.get('closing_cost_rate', 0.08),
                    'interest_rate': prop.get('interest_rate', 0.07),
                    'down_payment_pct': prop.get('down_payment_pct', 0.20)
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
                
                # Apply garage filter
                if filters.requires_garage and not property_data.get('has_garage'):
                    continue
                
                # Apply home style filter
                if filters.home_styles and property_data.get('home_style') not in filters.home_styles:
                    continue
                
                # Apply neighborhood quality filters
                if filters.exclude_damaged_nearby and property_data.get('nearby_damaged_properties', 0) > 0:
                    continue
                
                # Filter out properties with long-vacant nearby homes
                if property_data.get('nearby_vacant_properties', 0) > 0:
                    continue
                
                # Apply days on market filter
                if filters.min_days_on_market > 0:
                    days_on_market = property_data.get('days_on_market', 0)
                    if days_on_market < filters.min_days_on_market:
                        continue
                
                # Assess contamination risk
                property_data = assess_contamination_risk(property_data)
                
                # Estimate missing values
                property_data = await estimate_property_values(property_data)
                
                # Calculate analysis
                analysis = await calculate_property_analysis(property_data, property_data['price'])
                
                # Calculate IRR (10-year projection)
                annual_cf = analysis.annual_cash_flow
                cash_flows = [annual_cf * (1.02 ** year) for year in range(10)]  # 2% annual growth
                initial_investment = property_data['price'] * property_data['down_payment_pct']
                irr_value = calculate_irr(cash_flows, initial_investment, 10)
                
                # Add calculated fields
                property_data['cap_rate'] = round(analysis.cap_rate, 2)
                property_data['roi'] = round(analysis.cash_on_cash_roi, 2)
                property_data['annual_cash_flow'] = round(analysis.annual_cash_flow, 2)
                property_data['noi'] = round(analysis.noi, 2)
                property_data['irr'] = round(irr_value, 2)
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

@api_router.patch("/properties/{zpid}")
async def update_property_details(zpid: str, updates: dict):
    """Update property financial details and recalculate metrics"""
    try:
        prop = await db.properties.find_one({"zpid": zpid}, {"_id": 0})
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Update fields
        for key, value in updates.items():
            if key in ['monthly_rent', 'insurance', 'deferred_maintenance', 'closing_cost_rate', 'interest_rate', 'down_payment_pct', 'price']:
                prop[key] = float(value)
        
        # Recalculate analysis using the updated price
        purchase_price = prop.get('price', prop['price'])
        analysis = await calculate_property_analysis(prop, purchase_price)
        
        # Calculate IRR
        annual_cf = analysis.annual_cash_flow
        cash_flows = [annual_cf * (1.02 ** year) for year in range(10)]
        initial_investment = prop['price'] * prop.get('down_payment_pct', 0.20)
        irr_value = calculate_irr(cash_flows, initial_investment, 10)
        
        # Update calculated fields
        prop['cap_rate'] = round(analysis.cap_rate, 2)
        prop['roi'] = round(analysis.cash_on_cash_roi, 2)
        prop['annual_cash_flow'] = round(analysis.annual_cash_flow, 2)
        prop['noi'] = round(analysis.noi, 2)
        prop['irr'] = round(irr_value, 2)
        
        # Save to database
        await db.properties.update_one(
            {"zpid": zpid},
            {"$set": prop}
        )
        
        return PropertyListing(**prop)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating property: {str(e)}")
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

async def refresh_city_list():
    """Refresh city list from Google Sheets"""
    try:
        logger.info("Refreshing city list from spreadsheet")
        cities = await get_cached_cities(force_refresh=True)
        logger.info(f"City list refreshed successfully: {len(cities)} cities")
    except Exception as e:
        logger.error(f"Error refreshing city list: {str(e)}")

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
                        "roi": {"$gte": prefs.min_roi * 100},
                        "irr": {"$gte": prefs.min_irr * 100}
                    },
                    {"_id": 0}
                ).sort("cap_rate", -1).limit(10).to_list(10)
                
                if not properties:
                    logger.info(f"No matching properties for {prefs.email}")
                    continue
                
                # Build email HTML
                frequency_label = {
                    "daily": "Daily",
                    "weekly": "Weekly",
                    "biweekly": "Bi-Weekly",
                    "monthly": "Monthly"
                }.get(prefs.frequency, "Weekly")
                
                html_content = f"""
                <html>
                  <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Your {frequency_label} St. Louis Property Report</h2>
                    <p>Here are the top investment properties that match your criteria:</p>
                    <p><strong>Criteria:</strong> Cap Rate ≥ {prefs.min_cap_rate*100}%, ROI ≥ {prefs.min_roi*100}%, IRR ≥ {prefs.min_irr*100}%</p>
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
                        <div><strong>IRR:</strong> <span style="color: #6366f1; font-weight: bold;">{prop.irr:.2f}%</span></div>
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
                message['Subject'] = f"{frequency_label} St. Louis Property Report - {len(properties)} Properties Found"
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

@api_router.post("/export-to-sheets")
async def export_to_sheets(data: dict):
    """Export selected properties to Google Sheets"""
    try:
        properties = data.get('properties', [])
        
        if not properties:
            raise HTTPException(status_code=400, detail="No properties provided")
        
        logger.info(f"Exporting {len(properties)} properties to Google Sheets")
        
        # Authenticate with Google Sheets
        credentials_path = os.environ.get('GOOGLE_CREDENTIALS_PATH')
        sheet_id = os.environ.get('GOOGLE_SHEET_ID')
        
        if not credentials_path or not sheet_id:
            raise HTTPException(status_code=500, detail="Google Sheets credentials not configured")
        
        # Setup Google Sheets API
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        creds = ServiceAccountCredentials.from_json_keyfile_name(credentials_path, scope)
        client = gspread.authorize(creds)
        
        # Open the spreadsheet
        spreadsheet = client.open_by_key(sheet_id)
        worksheet = spreadsheet.worksheet("Stl_InvPro_List")  # Use the Stl_InvPro_List sheet
        
        # Prepare data rows to match Stl_InvPro_List sheet structure
        # Columns: ID, Address, Sold?, # Bedrom, # Bath, Sqft, ZillowLink, Cap Rate, IRR, 
        #          As is?, Currently Rented?, Est. Rent, Suggested Price, List Price, 
        #          Neighborhood, Median Rent for 2 Bed, Renter Occupied HH %, School Rating
        rows = []
        for prop in properties:
            # Safely format percentage values
            cap_rate = prop.get('cap_rate')
            roi = prop.get('roi')
            irr = prop.get('irr')
            
            row = [
                prop.get('zpid', ''),                                          # Column 1: ID
                prop.get('address', ''),                                       # Column 2: Address
                '',                                                            # Column 3: Sold?
                prop.get('bedrooms', ''),                                      # Column 4: # Bedrom
                prop.get('bathrooms', ''),                                     # Column 5: # Bath
                prop.get('sqft', ''),                                         # Column 6: Sqft
                prop.get('url', ''),                                          # Column 7: ZillowLink (View on Zillow URL)
                f"{cap_rate:.2f}%" if cap_rate is not None else '',          # Column 8: Cap Rate
                f"{irr:.2f}%" if irr is not None else '',                    # Column 9: IRR
                '',                                                            # Column 10: As is?
                '',                                                            # Column 11: Currently Rented?
                prop.get('monthly_rent', ''),                                 # Column 12: Est. Rent
                '',                                                            # Column 13: Suggested Price
                prop.get('price', ''),                                        # Column 14: List Price
                f"{prop.get('city', '')}, {prop.get('state', '')} {prop.get('zip_code', '')}",  # Column 15: Neighborhood
                '',                                                            # Column 16: Median Rent for 2 Bed
                '',                                                            # Column 17: Renter Occupied HH %
                ''                                                             # Column 18: School Rating
            ]
            rows.append(row)
        
        # Append rows to the sheet
        worksheet.append_rows(rows, value_input_option='USER_ENTERED')
        
        logger.info(f"Successfully exported {len(properties)} properties to Google Sheets")
        
        return {
            "message": f"Successfully exported {len(properties)} properties to Google Sheets",
            "sheet_url": f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"
        }
        
    except Exception as e:
        logger.error(f"Error exporting to sheets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/email-selected-properties")
async def email_selected_properties(data: dict):
    """Email selected properties to user"""
    try:
        properties = data.get('properties', [])
        recipient_email = data.get('email', '')
        
        if not properties:
            raise HTTPException(status_code=400, detail="No properties provided")
        
        if not recipient_email:
            raise HTTPException(status_code=400, detail="No email address provided")
        
        logger.info(f"Emailing {len(properties)} properties to {recipient_email}")
        
        # Build email HTML
        html_content = f"""
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Your Selected St. Louis Investment Properties</h2>
            <p>Here are the {len(properties)} properties you selected for review:</p>
            <hr/>
        """
        
        for prop in properties:
            html_content += f"""
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; background: #f9fafb;">
              <h3 style="margin-top: 0; color: #1f2937;">{prop.get('address', '')}, {prop.get('city', '')}</h3>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 16px 0;">
                <div><strong>Price:</strong> ${prop.get('price', 0):,.0f}</div>
                <div><strong>Bedrooms:</strong> {prop.get('bedrooms', 'N/A')}</div>
                <div><strong>Cap Rate:</strong> <span style="color: #059669; font-weight: bold;">{prop.get('cap_rate', 0):.2f}%</span></div>
                <div><strong>ROI:</strong> <span style="color: #059669; font-weight: bold;">{prop.get('roi', 0):.2f}%</span></div>
                <div><strong>IRR:</strong> <span style="color: #6366f1; font-weight: bold;">{prop.get('irr', 0):.2f}%</span></div>
                <div><strong>Cash Flow:</strong> ${prop.get('annual_cash_flow', 0):,.0f}/year</div>
                <div><strong>Monthly Rent:</strong> ${prop.get('monthly_rent', 0):,.0f}</div>
                <div><strong>NOI:</strong> ${prop.get('noi', 0):,.0f}/year</div>
              </div>
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Property Tax:</strong> ${prop.get('property_tax', 0):,.0f}/year</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Insurance:</strong> ${prop.get('insurance', 0):,.0f}/year</p>
              </div>
              <a href="{prop.get('url', '#')}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View on Zillow</a>
            </div>
            """
        
        html_content += """
          <hr/>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
            This email was generated from your STL Real Estate Analyzer. 
            Review these properties carefully and conduct proper due diligence before making any investment decisions.
          </p>
          </body>
        </html>
        """
        
        # Send email
        message = MIMEMultipart('alternative')
        message['Subject'] = f"Your Selected Properties - {len(properties)} Investment Opportunities"
        message['From'] = os.environ.get('GMAIL_ADDRESS')
        message['To'] = recipient_email
        
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
        
        logger.info(f"Successfully emailed {len(properties)} properties to {recipient_email}")
        
        return {
            "message": f"Successfully emailed {len(properties)} properties to {recipient_email}"
        }
        
    except Exception as e:
        logger.error(f"Error emailing properties: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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