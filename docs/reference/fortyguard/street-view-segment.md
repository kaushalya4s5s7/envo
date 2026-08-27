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
Street View Segmentation
POST

AVAILABLE IN
API Premium
This endpoint performs segmentation analysis on street view imagery to identify and classify urban features, building facades, vegetation, road surfaces, and thermal characteristics from ground-level perspectives.
Required attributes

latitude
number
Latitude coordinate of the street view location.
longitude
number
Longitude coordinate of the street view location.
vertical_angle
number
Vertical viewing angle in degrees (tilt up/down).
horizontal_angle
number
Horizontal viewing angle in degrees (pan left/right, 0-360).
back_view
boolean
Whether to capture the back view (opposite direction).
Result Schema Breakdown

Result Output Fields

Coordinates
object
Location that was analyzed.
latitude (string) - Latitude value
longitude (string) - Longitude value
Front
object
Street View "front" camera results for that location.
original_image (string) - Base64-encoded original street view image. Note: If raw Base64, users may need data:image/png;base64, to render in a browser
segments (object) - Class coverage values (typically percentages of the image)
image_legend (object) - RGB color legend for rendering the segmentation output
segmented_image (string) - Base64-encoded segmentation mask image, decode to display/save the segmentation output
image_date (string) - Date the Street View image was captured, in YYYY-MM-DD format
REQUEST
Python
import requests

response = requests.post(
    'https://api.fortyguard.com/v1/streetview',
    headers={'api-key': 'your_api_key'},
    json={
        'latitude': 40.7128,
        'longitude': -74.0060,
        'vertical_angle': 10.0,
        'horizontal_angle': 90.0,
        'back_view': False
    }
)
Copy
RESPONSE
{
  "error": false,
  "status_code": 200,
  "message": "Street View Segmentation Submitted Successfully",
  "data": {
    "activity_id": "e574b989-c100-4a03-97d8-beef65656623"
  }
}
Copy
RESULT SCHEMA
{
  "error": false,
  "status_code": 200,
  "message": "Completed",
  "data": {
    "activity_id": "e574b989-c100-4a03-97d8-beef65656623",
    "status": "Completed",
    "result": {
      "coordinates": {
        "latitude": "40.7128",
        "longitude": "-74.006"
      },
      "front": {
        "original_image": "",
        "segments": {},
        "image_legend": {},
        "segmented_image": "",
        "image_date": "YYYY-MM-DD"
      }
    }
  }
}
Copy