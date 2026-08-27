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
Heat Intelligence
POST

AVAILABLE IN
API Premium
Heat Intelligence transforms raw temperature data into comprehensive, multi-dimensional intelligence reports for any urban location. This service examines spatial and temporal temperature patterns through five targeted analytics categories—Geographic, Environmental, Urban, Events, and Anthropogenic—providing deep, actionable insights for urban planning, climate resilience, and infrastructure design.
Required attributes

latitude
number
Latitude coordinate of the location to analyze.
longitude
number
Longitude coordinate of the location to analyze.
temperature
number
Temperature value in degrees Fahrenheit for the location.
date
string
Date for the temperature reading in YYYY-MM-DD format. Must fall between 2019-01-01 and 12 hours past the current time, and should match the date/time of the heatmap that produced this temperature. Out-of-range dates are rejected with 400 Bad Request.
analysis
array[string]
Type of analysis options:
"geographic"
"environmental"
"urban"
"events"
"anthropogenic"
Heat Intelligence Result Flow

Heat Intelligence uses the same status endpoint as other asynchronous activities, but the completed status response returns JSON with data.result.download_link. The status endpoint does not stream the PDF directly. Heat Intelligence report generation may take several minutes. The download_link is temporary. Use it immediately to download the PDF, do not log or share the full signed URL, and stop polling once Completed and download_link are returned. Failed is a terminal status.
Retrieving the Result

To retrieve the completed endpoint-specific result, configure your request as follows:

import time
from pathlib import Path

import requests

activity_id = "f3e1c68b-1cc3-46bc-8589-1faaf30ef30a"
headers = {"api-key": "your_api_key"}
status_url = f"https://api.fortyguard.com/v1/status/{activity_id}"

for _ in range(120):
    status_resp = requests.get(status_url, headers=headers, timeout=30)
    status_resp.raise_for_status()
    data = status_resp.json()["data"]
    status = data.get("status")

    if status == "Completed":
        download_link = (data.get("result") or {}).get("download_link")
        if not download_link:
            raise RuntimeError(f"Activity {activity_id} completed without a download_link")

        report_resp = requests.get(download_link, timeout=60)
        report_resp.raise_for_status()
        Path("report.pdf").write_bytes(report_resp.content)
        print("Saved to report.pdf")
        break

    if status == "Failed":
        raise RuntimeError(f"Activity {activity_id} failed")

    time.sleep(5)
else:
    raise TimeoutError(f"Activity {activity_id} did not complete in time")
Copy
Notes

The status endpoint returns JSON; it does not stream the PDF
Heat Intelligence report generation may take several minutes
The download_link is temporary and should be used immediately
Do not log or share the full signed URL
Stop polling once Completed and download_link are returned
Failed is terminal; stop polling and record the activity_id
Result Output Fields

data.status
string
Activity state. Continue bounded polling while Processing, stop on Completed or Failed.
data.result.download_link
string
Temporary signed URL for the Heat Intelligence PDF when status is Completed.
REQUEST
Python
import requests

response = requests.post(
    'https://api.fortyguard.com/v1/heat_intelligence',
    headers={'api-key': 'your_api_key'},
    json={
        'latitude': 40.7128,
        'longitude': -74.0060,
        'temperature': 82.4,
        'date': '2024-07-15',
        'analysis': ['environmental']
    }
)
Copy
RESPONSE
{
  "error": false,
  "status_code": 200,
  "message": "Heat Intelligence Submitted Successfully",
  "data": {
    "activity_id": "f3e1c68b-1cc3-46bc-8589-1faaf30ef30a"
  }
}
Copy