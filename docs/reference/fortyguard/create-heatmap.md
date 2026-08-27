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
Create Heatmap
POST

AVAILABLE IN
API Basic
API Premium
Basic
Generate heatmaps up to 10 mi² area. Includes full access to Map Statistics.
Premium
Generate heatmaps up to 50 mi² area. Includes full access to Map Statistics.
The Heatmap Generation feature produces high-resolution thermal maps derived from spatial and temporal inputs. Built on FortyGuard's proprietary Large Temperature Models (LTMs), each output is a GeoJSON polygon layer with tiles containing predicted or observed temperature data.
Required attributes

polygon_aoi
object
GeoJSON polygon defining the area of interest for heatmap generation.
date_time
object
Date and time range configuration object.
date_time.start_date
string
Start date in YYYY-MM-DD format. Supported range: 2019-01-01 through 12 hours past the current time.
2019 up to now — historical / real-time heatmaps
up to 12 hours into the future — forecast heatmaps
Dates before 2019, or more than 12 hours ahead of the current time, are rejected with 400 Bad Request.
date_time.filter_type
number
Filter type options:
1 (Single Hour) - requires start_date and start_time
2 (Range of Hours, same day) - requires start_date, start_time, and end_time
3 (Single Day) - requires only start_date (covers 00:00–23:59)
4 (Range of Days — week / month, ≤ 1 month) - requires start_date and end_date
granularity
number
Spatial resolution/granularity level options:
60m
80m
100m
Optional attributes

date_time.end_date
string
End date in YYYY-MM-DD format. Required for filter_type 4; auto-populated for filter_type 1–3.
date_time.start_time
string
Start time in HH:MM 24-hour format. Required for filter_type 1 and 2.
date_time.end_time
string
End time in HH:MM 24-hour format. Required for filter_type 2. Auto-calculated for filter_type 1 (start_time + 1 hour).
analytic_type
string
Analysis heatmap type (default 'tcm'):
tcm — Temperature snapshot; value is temperature (°C) per tile
time_of_measure — hour of day (0–23, UTC) at which the peak temperature occurs
exceedance — number of hours the temperature passes the threshold
persistence — longest continuous run of hours past the threshold
time_of_measure, exceedance and persistence return values in hours (stats_data.units = "hour"); tcm returns °C.
threshold
number
Temperature threshold in °C for exceedance / persistence. Defaults to 30 °C. Ignored by tcm and time_of_measure.
direction
string
Threshold direction for exceedance / persistence: 'above' (default) counts hours above the threshold, 'below' counts hours below it. Ignored by tcm and time_of_measure.
Result Schema Breakdown

Once the heatmap generation activity has finished processing, the final response contains two main outputs:

GeoJSON heatmap tiles (map_data)
Aggregated temperature statistics (stats_data)
This response is returned when the activity status is "Completed".
Result Output Fields

Result.map_data
GeoJSON FeatureCollection
Tile-based heatmap output formatted as GeoJSON polygons.
Result.stats_data
object
Aggregated statistical summary of all tiles in the heatmap. This includes:
Temperature_stats - Temperature statistics across the heatmap region
Minimum: Lowest temperature across the heatmap region
Maximum: Highest temperature across the heatmap region
Mean: Average temperature value
Standard_deviation: Variability of temperatures across tiles
Overall_temperature_distribution (array[number]) - Sorted temperature values representing the overall distribution
Normal_temperature_distribution (object) - Normalized curve data for plotting a temperature distribution
x_axis: Temperature range
y_axis: Probability density values
Temperature_frequency (object) - Histogram-style frequency counts for temperature bins
REQUEST
Single Hour
Range of Hours
Single Day
Range of Days
Exceedance
Time of Measure
Persistence
Python
import requests

response = requests.post(
    'https://api.fortyguard.com/v1/heatmap',
    headers={'api-key': 'your_api_key'},
    json={
        'polygon_aoi': {
            'type': 'FeatureCollection',
            'features': [
                {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [[
                            [-74.0170, 40.7050],
                            [-74.0030, 40.7050],
                            [-74.0030, 40.7180],
                            [-74.0170, 40.7180],
                            [-74.0170, 40.7050]
                        ]]
                    }
                }
            ]
        },
        'date_time': {
            'start_date': '2024-07-15',
            'start_time': '14:00',
            'filter_type': 1
        },
        'granularity': 100
    }
)
Copy
RESPONSE
{
  "error": false,
  "status_code": 200,
  "message": "Heatmap Submitted Successfully",
  "data": {
    "activity_id": "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df"
  }
}
Copy
RESULT SCHEMA
{
  "error": false,
  "status_code": 200,
  "message": "Completed",
  "data": {
    "activity_id": "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df",
    "status": "Completed",
    "result": {
      "map_data": {},
      "stats_data": {}
    }
  }
}
Copy