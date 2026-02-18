# Client-Side Implementation Specification

## Multiplayer Streetwise Roller

## Goals

-   Self-register via join link
-   Store player token in memory
-   Poll events using since_id
-   Broadcast roll results
-   Handle GM controls separately

------------------------------------------------------------------------

## Join Flow

1.  Open /join page
2.  Extract join token from URL fragment (#join=token)
3.  Prompt for display_name
4.  POST /api/join Authorization: Bearer `<join_token>`{=html}

On success: - Store player_token in memory - Clear fragment from URL -
Navigate to session view

------------------------------------------------------------------------

## Authentication

All requests: 
  Authorization: Bearer `<player_token>`{=html}

Implement shared apiFetch helper to attach token.

------------------------------------------------------------------------

## Polling Loop

Endpoint: GET /api/events?since_id=`<int>`{=html}

Algorithm: 
  - Start interval at 1000ms 
  - On 200 response: 
    - Append events 
    - Update since_id 
    - Reset interval to \~1000ms 
  - On 204: 
    - Increase interval (x1.5) up to 8000ms 
  - On error: 
    - Exponential backoff up to 30000ms 
    - Add jitter +/-20%

Stop polling on component unmount.

------------------------------------------------------------------------

## Event Handling

Event structure: 
  { 
    id, 
    type, 
    created_at, 
    actor: { 
      name, 
      role 
    }, 
    payload
  }

Supported types: 
  - roll 
  - scene_strain_set

Update UI accordingly.

------------------------------------------------------------------------

## Posting Roll Results

POST /api/rolls Authorization: Bearer `<player_token>`{=html}

Body example: { "system": "streetwise", "pool": {...}, "result": {...} }

------------------------------------------------------------------------

## GM View (Optional)

Capabilities: - Rotate join link - Enable/disable joining - Set scene
strain - List players - Revoke players

------------------------------------------------------------------------

## State Initialization

On load: GET /api/session Set since_id from latest_event_id.

------------------------------------------------------------------------

## Acceptance Criteria

-   Players join via link and receive unique token
-   Events propagate within \~1--2 seconds
-   Polling backs off when idle
-   GM can rotate join link
-   GM can revoke individual players
