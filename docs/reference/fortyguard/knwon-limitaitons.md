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
Known Limitations

This page documents the current operational, technical, and plan-level limits of the FortyGuard Enterprise API. It is maintained alongside each release so you can plan integrations, size workloads, and anticipate constraints before hitting them in production.

Plan Limits

Every API key is associated with a subscription plan. The table below summarizes what each plan includes. See each endpoint page for plan-specific behavior.

CAPABILITY	API BASIC	API PREMIUM	API STARTUP
Monthly credits	1,000,000	5,000,000	1,000,000
Commercial License	Included	Included	Included
Heatmap Generation (max area)	Up to 10 mi²	Up to 50 mi²	Up to 10 mi²
Map Statistics	Full access	Full access	Full access
Environmental Parameters	Up to 3 parameters per request	Full access to all parameters	Up to 3 parameters per request
Satellite Segmentation	Not included	Included	Not included
Street View Segmentation	Not included	Included	Not included
Heat Intelligence Reports	Not included	Included	Not included
Access window	Monthly (renews each cycle)	Monthly (renews each cycle)	6 months (one-time)
Regional coverage	United States only	United States only	United States only
Input Constraints

Requests that violate the following constraints return 400 Bad Request and are not charged against your credit balance.

Coordinates:latitude must be in the range [-90, 90] and longitude in [-180, 180]. During the current release, coordinates must fall within the United States.
Polygon Area of Interest: must be a valid GeoJSON FeatureCollection whose geometry is a closed Polygon (first and last coordinates identical).
Date format:start_date and end_date must be YYYY-MM-DD. start_time and end_time must be HH:MM in 24-hour time.
Date range: all date and time inputs must fall between 2019-01-01 and the present day. Create Heatmap additionally supports forecasting up to 12 hours beyond the current time — so the latest accepted value is now + 12 hours. Any date/time earlier than 2019-01-01 or more than 12 hours in the future is rejected. For Satellite Segmentation, Environmental Parameters, and Heat Intelligence, the date/time should match the heatmap you generated for the same location and time.
Filter types:filter_type must be 1 (Single Hour), 2 (Range of Hours), or 3 (Single Day). Max supported range for filter_type = 2 — 23Hrs.
Granularity:granularity must be one of 60m, 80m, or 100m.
Heat Intelligence analysis:analysis must be a subset of ["geographic", "environmental", "urban", "events", "anthropogenic"].
Processing & Results

Activity lifecycle: submission endpoints return an activity_id. Results are retrieved asynchronously via the GET /v1/status/{activity_id} endpoint.
Failed tasks: tasks that fail during processing (status Failed) do not consume credits.
Image encoding: segmentation outputs return Base64-encoded images. If the response omits the MIME prefix, prepend data:image/png;base64, before rendering in a browser.
Heat Intelligence reports: the completed status response returns JSON with data.result.download_link. The link is temporary; use it immediately to download the PDF, and do not log or share the full signed URL.
Regional Coverage

The current release supports requests for locations within the United States on the API Basic, API Premium, and API Startup plans.
Credits & Billing

Credits are deducted only on successful task completion (status Completed).
Unused credits do not roll over between billing cycles — they reset on your credits_reset_date.
API Startup: a one-time allocation of 1,000,000 credits valid for a 6-month access window (not a recurring monthly cycle).
Reporting an Issue

If you hit a limit that is not documented here, or a documented limit that is incorrect, please contact support@fortyguard.com.