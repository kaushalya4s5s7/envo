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
Check Status
GET

AVAILABLE IN
API Basic
API Premium
This endpoint allows you to check the status of any submitted activity using the unique activity ID. When the activity is completed, the response will include the final results and output data.
Required attributes

activity_id
string
Unique identifier for the activity (returned from any submission endpoint).
REQUEST
Python
import requests

# Replace {activity_id} with the actual activity ID from your submission
activity_id = "heatmap_abc123"

response = requests.get(
    f'https://api.fortyguard.com/v1/status/{activity_id}',
    headers={'api-key': 'your_api_key'}
)
Copy
RESPONSE
{
  "error": false,
  "status_code": 200,
  "message": "Processing",
  "data": {
    "activity_id": "f3e1c68b-1cc3-46bc-8589-1faaf30ef30a",
    "status": "Processing"
  }
}
Copy