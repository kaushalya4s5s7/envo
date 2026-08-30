# FortyGuard reference

This directory is the repository's source of truth for the FortyGuard integration. The request and
response details here are the basis for [`core/src/weather/fortyguard/`](../../../core/src/weather/fortyguard/)
and the live capture route.

## Reference files

| File | Purpose |
|---|---|
| [`api.md`](api.md) | Verified API boundary, resolution findings, and claim limits |
| [`create-heatmap.md`](create-heatmap.md) | Heatmap request and response notes |
| [`check-status-taskmanagemnt.md`](check-status-taskmanagemnt.md) | Asynchronous task polling notes |
| [`enviornment-parameter.md`](enviornment-parameter.md) | Environmental parameter request and response notes |
| [`satellite-view.md`](satellite-view.md) | Surface and segmentation notes |
| [`street-view-segment.md`](street-view-segment.md) | Segment and street-view notes |
| [`samples/`](samples/) | Captured response samples used to type and test normalization |

## Integration boundary

FortyGuard appears as a vendor name only inside `core/src/weather/fortyguard/` and this reference
directory. The rest of the application consumes the normalized `EnvSnapshot` contract.

Live requests are restricted to address capture and fixture generation. The deterministic replay
surface reads committed fixtures and does not call FortyGuard.

## Claim boundary

The heatmap supports a block-level temperature claim. Air quality is metro-scale, PM2.5 is a daily
signal, and the product must not claim hyperlocal ozone or PM2.5. Current product claims are governed
by [`../../decisions/product/what-we-can-claim.md`](../../decisions/product/what-we-can-claim.md).

Never commit API keys or other credentials. Use the server-side environment variables documented in
[`../../../.env.example`](../../../.env.example).
