Authentication

FortyGuard's Enterprise API uses API key–based authentication to ensure secure and controlled access to all endpoints.

Every request to the API must include a valid API Key provided to you upon registration or via your organization's FortyGuard admin console.

Authentication is handled via request headers, making integration lightweight and straightforward. No OAuth flow or token exchange is required.

Header Format

Include your API key in the header of every request as follows:

api-key: YOUR_API_KEY
Copy
Example (Python)

Below is a simple Python example using the requests library to authenticate and call the Heatmap Generation endpoint:

import requests

url = "https://api.fortyguard.com/v1/heatmap"
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

response = requests.post(url, headers=headers, json=payload)

if response.status_code == 200:
    print("Request successful!")
    print(response.json())
else:
    print(f"Error {response.status_code}: {response.text}")