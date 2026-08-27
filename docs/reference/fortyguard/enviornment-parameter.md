FortyGuard Logo
API


GUIDES
Introduction
Quickstart
Authentication
ANALYSIS ENDPOINTS
Create Heatmap
POST
Satellite View Segmentation
POST
Street View Segmentation
POST
Heat Intelligence
POST
Environmental Parameters
POST
TASK MANAGEMENT
Check Status
GET
Check API Credits Usage
GET
RESOURCES
Known Limitations
Release Notes
Environmental Parameters
POST

AVAILABLE IN
API Basic
API Premium
Basic
Up to 3 customizable environmental parameters per request.
Premium
Full access to all environmental parameters.
A multidimensional temperature intelligence service offering operationally vital metrics including heat index, apparent temperature, and wet bulb temperature for thermal stress assessment. Captures atmospheric and hydrological variables (precipitation, AQI, ozone levels) plus solar irradiance profiles (GHI, DNI, DHI) to support energy modeling, urban planning, and climate resilience.
Required attributes

latitude
number
Latitude coordinate of the location.
longitude
number
Longitude coordinate of the location.
temperature
number
Temperature value in degrees Celsius for the location.
date_time
object
Date and time range configuration object.
date_time.start_date
string
Start date in YYYY-MM-DD format. Must fall between 2019-01-01 and 12 hours past the current time, and should match the date/time of the heatmap you generated for this location. Out-of-range dates are rejected with 400 Bad Request.
date_time.filter_type
number
Filter type options:
1 (Single Hour) - requires start_date and start_time
2 (Range of Hours) - requires start_date, start_time, and end_time
3 (Single Day) - requires only start_date
Optional attributes

date_time.end_date
string
End date in YYYY-MM-DD format. Auto-populated based on filter_type.
date_time.start_time
string
Start time in HH:MM 24-hour format. Required for filter_type 1 and 2.
date_time.end_time
string
End time in HH:MM 24-hour format. Required for filter_type 2.
analysis
string[]
Optional list of environmental parameters to return. Omit to receive all of them. API Basic and API Startup are limited to 3 parameters per request; API Premium has full access.
Thermal & atmospheric:
heat_index_celsius — heat index ("feels like"), °C
apparent_temperature_celsius — apparent temperature, °C
wet_bulb_temperature_celsius — wet-bulb temperature, °C
relative_humidity_percent — relative humidity, %
precipitation_mm — precipitation, mm
cloud_cover_octas — effective cloud cover, octas
elevation — ground elevation, m
Air quality (US AQI) & gases:
air_quality:idx — overall US Air Quality Index
air_quality_pm2p5:idx — AQI, PM2.5
air_quality_pm10:idx — AQI, PM10
air_quality_no2:idx — AQI, nitrogen dioxide
aqi_us_co — AQI, carbon monoxide
air_quality_o3:idx — AQI, ozone
air_quality_so2:idx — AQI, sulphur dioxide
methane_ppb — methane, ppb
co2_ppm — carbon dioxide, ppm
Solar:
solar_irradiance — clear-sky GHI / DNI / DHI
Result Schema Breakdown

Once the environmental parameters analysis activity has finished processing, the final response contains three main outputs:

Time metadata (metadata) - timezone + the exact timestamps/time range the data corresponds to
Location context (locations) - the latitude/longitude (and often elevation) that was analyzed
Environmental outputs (parameters + solar_irradiance) - time-aligned arrays of weather/comfort, air-quality, gases, and solar irradiance metrics
Missing numeric values:

New missing numeric environmental values are returned as JSON null
Older stored responses may still contain legacy -999
null means data was unavailable from the upstream provider
Missing values must not be interpreted as zero
Response arrays and live field names remain unchanged
This response is returned when the activity status is "Completed".
REQUEST
Python
import requests

response = requests.post(
    'https://api.fortyguard.com/v1/env_params',
    headers={'api-key': 'your_api_key'},
    json={
        'latitude': 40.7128,
        'longitude': -74.0060,
        'temperature': 32.5,
        'date_time': {
            'start_date': '2024-07-15',
            'start_time': '14:00',
            'filter_type': 1
        }
    }
)
Copy
RESPONSE
{
  "error": false,
  "status_code": 200,
  "message": "Environment Parameters Analysis Submitted Successfully",
  "data": {
    "activity_id": "f501e334-572b-40c4-8eb9-c9b679eff6ee"
  }
}
Copy
RESULT SCHEMA
{
  "error": false,
  "status_code": 200,
  "message": "Completed",
  "data": {
    "activity_id": "UUID_STRING",
    "status": "Completed",
    "result": {
      "metadata": {
        "timezone": "TIMEZONE_STRING",
        "timezone_offset_hours": "NUMBER",
        "time_range": {
          "start": "YYYY-MM-DDTHH:MM:SS±HH:MM",
          "end": "YYYY-MM-DDTHH:MM:SS±HH:MM",
          "interval": "TIME_INTERVAL_STRING",
          "count": "INTEGER"
        },
        "timestamps": [
          "YYYY-MM-DDTHH:MM:SS±HH:MM"
        ]
      },
      "locations": [
        {
          "lat": "NUMBER",
          "lon": "NUMBER",
          "elevation": "NUMBER",
          "temperature": "NUMBER",
          "parameters": {
            "heat_index_celsius": ["NUMBER_OR_NULL"],
            "apparent_temperature_celsius": ["NUMBER_OR_NULL"],
            "relative_humidity_percent": ["NUMBER_OR_NULL"],
            "precipitation_mm": ["NUMBER_OR_NULL"],
            "cloud_cover_octas": ["NUMBER_OR_NULL"],
            "wet_bulb_temperature_celsius": ["NUMBER_OR_NULL"],
            "air_quality:idx": ["NUMBER_OR_NULL"],
            "air_quality_pm2p5:idx": ["NUMBER_OR_NULL"],
            "air_quality_pm10:idx": ["NUMBER_OR_NULL"],
            "air_quality_no2:idx": ["NUMBER_OR_NULL"],
            "aqi_us_co": ["NUMBER_OR_NULL"],
            "air_quality_o3:idx": ["NUMBER_OR_NULL"],
            "air_quality_so2:idx": ["NUMBER_OR_NULL"],
            "methane_ppb": ["NUMBER_OR_NULL"],
            "co2_ppm": ["NUMBER_OR_NULL"]
          },
          "solar_irradiance": {
            "clear_sky": {
              "ghi": "NUMBER",
              "dni": "NUMBER",
              "dhi": "NUMBER"
            },
            "description": "STRING_EXPLANATION_OF_SOLAR_OUTPUT"
          }
        }
      ]
    }
  }
}
Copy