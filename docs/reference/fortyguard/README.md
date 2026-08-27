# FortyGuard reference — EMPTY, NEEDED

This folder is the **only** permitted source for FortyGuard API facts. Nothing here yet, so
`core/src/weather/fortyguard/` is blocked.

## What to drop in here

Paste or save the docs in any form: a markdown export, a PDF, an OpenAPI or Postman file, or a
screenshot set. Raw is fine, it does not need tidying.

## What the client cannot be written without

| # | Needed | Used for |
|---|---|---|
| 1 | Base URL and **auth scheme** (header name, bearer vs key, any signing) | Every request |
| 2 | **Endpoint list** with paths and HTTP methods | The call chain |
| 3 | Whether heatmap creation is **sync or async**, and if async, how to poll and what the terminal states are | Retry and backoff logic |
| 4 | **Request shape** per endpoint: required and optional fields, how a location is specified (lat/lon, bbox, segment id) | Building requests |
| 5 | **Response shape** per endpoint, with an example payload | Normalization and types |
| 6 | **Exact parameter names and units** for: wet bulb, apparent temperature, ozone, PM2.5, DNI, DHI, cloud cover | The whole decision layer |
| 7 | How a **forecast** is requested and what horizon and step it returns | Pre cooling and pre positioning |
| 8 | **Tier differences**: what Basic allows vs Premium, and whether there is a per call parameter limit | Call planning |
| 9 | **Rate limits and quotas** | Capture strategy |
| 10 | Whether **segmentation** is a separate call or part of the heatmap response | Facade context |

Partial is still useful. Items 1, 2, 5, and 6 unblock the most.

## Also needed, separately

- The **API key**, in `.env.local`, never committed
- Which **tier** the key is on
- The **demo location**: a US city and ideally a specific building or lat/lon
