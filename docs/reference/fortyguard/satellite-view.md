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
Satellite View Segmentation
POST

AVAILABLE IN
API Premium
Analyze a specific location using latitude and longitude coordinates.
Required attributes

sat
object
Satellite data object containing location coordinates.
sat.latitude
number
Latitude coordinate of the location.
sat.longitude
number
Longitude coordinate of the location.
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
granularity
number
Spatial resolution/granularity level options:
60
80
100
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
Result Schema Breakdown

Once the satellite segmentation activity has finished processing, the final response contains three main outputs:

Location metadata (coordinates) - the latitude/longitude that was analyzed
Source imagery (orignal_image) - the original satellite image returned as Base64
Segmentation outputs (segmentation) - class coverage %, legend colors, and the segmentation mask returned as Base64
This response is returned when the activity status is "Completed".
Result Output Fields

Coordinates
object
Location that was analyzed.
latitude (string) - Latitude value
longitude (string) - Longitude value
Orignal_image
array[string]
One or more Base64-encoded original satellite images (typically PNG/JPEG). Note: If you return raw Base64 (no prefix), users may need to prepend: data:image/png;base64, to render in a browser.
Image_year
number
Year of the satellite imagery used for the segmentation.
Segmentation
object
Model output + metadata for the satellite image.
image_dimensions (object) - Output image size in pixels
height (number): Pixel height
width (number): Pixel width
mode (string) - Processing mode (e.g., "sat" for satellite)
processing_time_seconds (number) - Time taken to run segmentation (seconds)
request_id (string) - Internal identifier for tracing/debugging
segments (object) - Class coverage values (typically percentages)
image_legend (object) - RGB legend for rendering the segmentation mask
image_content (string) - Base64-encoded segmentation mask image, decode to display/save the segmentation output. Note: If raw Base64, users may need data:image/png;base64, to render in a browser
REQUEST
Python
import requests

response = requests.post(
    'https://api.fortyguard.com/v1/satellite',
    headers={'api-key': 'your_api_key'},
    json={
        'sat': {
            'latitude': 41.84632807720175,
            'longitude': -87.74329628220852
        },
        'date_time': {
            'start_date': '2024-07-15',
            'start_time': '14:00',
            'filter_type': 1
        },
        'granularity': 80
    }
)
Copy
RESPONSE
{
  "error": false,
  "status_code": 200,
  "message": "Satellite Segmentation Submitted Successfully",
  "data": {
    "activity_id": "66dc8797-e17b-4929-af39-5078ce4fc45a"
  }
}
Copy
RESULT SCHEMA
{
  "error": false,
  "status_code": 200,
  "message": "Completed",
  "data": {
    "activity_id": "66dc8797-e17b-4929-af39-5078ce4fc45a",
    "status": "Completed",
    "result": {
      "coordinates": {
        "latitude": "41.84632807720175",
        "longitude": "-87.74329628220852"
      },
      "orignal_image": [""],
      "image_year": 2026,
      "segmentation": {
        "image_dimensions": {
          "height": 350,
          "width": 350
        },
        "mode": "sat",
        "processing_time_seconds": 0.273295,
        "request_id": "632fcd03",
        "segments": {},
        "image_legend": {},
        "image_content": ""
      }
    }
  }
}
Copy