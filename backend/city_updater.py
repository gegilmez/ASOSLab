"""
Automatic city list updater from Google Sheets
Fetches cities from STL neighborhoods sheet where "In Radar?" = "yes"
"""
import httpx
import logging
import json
from datetime import datetime
from typing import List

logger = logging.getLogger(__name__)

SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1wGCQayg2I--ElRG9wJuPvInmVn5ktAMcNHFBAmG-N7o/export?format=csv&gid=STL_neighborhoods"

# Default cities if sheet is unavailable
DEFAULT_CITIES = [
    "St. Louis City",
    "University City",
    "Clayton",
    "Kirkwood",
    "Webster Groves",
    "St. Charles",
    "St. Peters",
    "Cottleville",
    "O'Fallon",
    "Wentzville",
    "Ladue"
]

async def fetch_cities_from_sheet() -> List[str]:
    """
    Fetch cities from Google Sheets where 'In Radar?' column is 'yes'
    """
    try:
        # Try multiple sheet export formats
        urls_to_try = [
            "https://docs.google.com/spreadsheets/d/1wGCQayg2I--ElRG9wJuPvInmVn5ktAMcNHFBAmG-N7o/export?format=csv&gid=0",
            "https://docs.google.com/spreadsheets/d/1wGCQayg2I--ElRG9wJuPvInmVn5ktAMcNHFBAmG-N7o/export?format=csv",
        ]
        
        cities = []
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for url in urls_to_try:
                try:
                    response = await client.get(url)
                    if response.status_code == 200:
                        # Parse CSV content
                        lines = response.text.strip().split('\n')
                        
                        # Find header row with "In Radar?"
                        header_idx = -1
                        for i, line in enumerate(lines[:5]):  # Check first 5 lines
                            if 'In Radar?' in line or 'in radar' in line.lower():
                                header_idx = i
                                break
                        
                        if header_idx >= 0:
                            header = lines[header_idx].split(',')
                            
                            # Find column indices
                            city_col_idx = 0  # Assume first column has city name
                            radar_col_idx = -1
                            
                            for idx, col in enumerate(header):
                                if 'radar' in col.lower():
                                    radar_col_idx = idx
                                    break
                            
                            if radar_col_idx >= 0:
                                # Parse data rows
                                for line in lines[header_idx + 1:]:
                                    if not line.strip():
                                        continue
                                    
                                    parts = line.split(',')
                                    if len(parts) > max(city_col_idx, radar_col_idx):
                                        city_name = parts[city_col_idx].strip().strip('"')
                                        in_radar = parts[radar_col_idx].strip().strip('"').lower()
                                        
                                        if in_radar == 'yes' and city_name:
                                            cities.append(city_name)
                                
                                if cities:
                                    logger.info(f"Successfully fetched {len(cities)} cities from sheet")
                                    return cities
                
                except Exception as e:
                    logger.warning(f"Error trying URL {url}: {str(e)}")
                    continue
        
        logger.warning("Could not fetch cities from sheet, using default list")
        return DEFAULT_CITIES
        
    except Exception as e:
        logger.error(f"Error fetching cities from sheet: {str(e)}")
        return DEFAULT_CITIES

async def get_active_cities() -> List[str]:
    """Get list of active cities for property search"""
    try:
        cities = await fetch_cities_from_sheet()
        
        # Clean up city names
        cleaned_cities = []
        for city in cities:
            # Skip generic entries
            if city.lower() in ['st. louis county', 'st. charles county', 'saint louis city']:
                continue
            cleaned_cities.append(city)
        
        return cleaned_cities if cleaned_cities else DEFAULT_CITIES
    
    except Exception as e:
        logger.error(f"Error getting active cities: {str(e)}")
        return DEFAULT_CITIES

# Cache for cities with timestamp
_cities_cache = {
    "cities": DEFAULT_CITIES,
    "last_updated": None
}

async def get_cached_cities(force_refresh: bool = False) -> List[str]:
    """Get cities with caching"""
    from datetime import datetime, timedelta
    
    # Refresh if forced or cache is older than 1 week
    should_refresh = force_refresh or \
                    _cities_cache["last_updated"] is None or \
                    datetime.now() - _cities_cache["last_updated"] > timedelta(days=7)
    
    if should_refresh:
        cities = await get_active_cities()
        _cities_cache["cities"] = cities
        _cities_cache["last_updated"] = datetime.now()
        logger.info(f"City list refreshed: {len(cities)} cities")
    
    return _cities_cache["cities"]
