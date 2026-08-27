Quickstart

Get started with the FortyGuard Enterprise API in minutes. This guide will help you authenticate, make your first request, and understand how to track and retrieve your task results.

Authentication

All requests to the FortyGuard Enterprise API require an API key. Simply include your API key within the request headers as shown below:

api-key: YOUR_API_KEY
Copy
No OAuth or token exchange is needed — your API key alone provides secure, authenticated access.

Making a Request

The Enterprise API currently offers six POST endpoints, each designed to handle different temperature intelligence operations (e.g., Heatmap Generation, Street View Segmentation, Heat Intelligence, Environmental Parameters, and more).

Each POST request submits a task to the FortyGuard Engine — for example, generating a heatmap or analyzing a property's thermal profile. When you submit a request, the API immediately returns an activity_id — a unique identifier representing your submitted task.

Tracking Task Status

Once you've received your activity_id, you can use it to query the status of your task using the corresponding status (GET) endpoint.

Use this general response and status guide when handling submissions and polling:

RESPONSE/STATUS	MEANING
400 / 422	Invalid request or validation error.
401	Missing or invalid API key.
403	Insufficient plan access or authorization.
404	Activity not found or temporarily unavailable immediately after submission.
429	Rate limit exceeded.
500	Server-side processing error.
Processing	Continue bounded polling.
Completed	Retrieve the endpoint-specific result.
Failed	Stop polling and record the activity ID.
Credits are only deducted after successful completion of a task (status: Completed).

If successful, the same status endpoint will also include the result payload (e.g., temperature data, GeoJSON map, or analytical report) in the response body.

Example Code (Python)

Below is a simplified example showing how to submit a task and then check its status.

Step 1 — Submit your request

import requests

submit_url = "https://api.fortyguard.com/v1/heatmap"
headers = {
    "api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
}

payload = {
    "polygon_aoi": {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
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
    "date_time": {
        "start_date": "2024-07-15",
        "start_time": "14:00",
        "filter_type": 1
    },
    "granularity": 100
}

response = requests.post(submit_url, headers=headers, json=payload)
activity_id = response.json()["data"]["activity_id"]
print(f"Task submitted. Activity ID: {activity_id}")
Copy
Step 2 — Check task status

import requests
import time

status_url = f"https://api.fortyguard.com/v1/status/{activity_id}"
headers = {
    "api-key": "YOUR_API_KEY"
}

for _ in range(120):
    status_response = requests.get(status_url, headers=headers)
    status_data = status_response.json()["data"]
    status = status_data["status"].lower()

    if status in ("completed", "succeeded"):
        print("Task completed successfully!")
        break
    elif status in ("failed", "error"):
        raise RuntimeError("Task failed.")
    else:
        print("Task is still processing...")
        time.sleep(5)
else:
    raise TimeoutError("Task did not complete in time.")