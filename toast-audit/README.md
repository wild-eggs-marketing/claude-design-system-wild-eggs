# Wild Eggs — Toast MLM Audit

Pulls menu, pricing, modifier, revenue center, dining option, and tax data across all Wild Eggs locations and produces a structured drift report.

## Setup

```bash
pip install requests
```

## Credentials

You need three values from Toast's developer portal:

| Variable | Where to find it |
|---|---|
| `TOAST_CLIENT_ID` | Toast developer portal → your integration → Client ID |
| `TOAST_CLIENT_SECRET` | Toast developer portal → your integration → Client Secret |
| `TOAST_MGMT_GROUP_GUID` | Toast admin → Management Groups → the Wild Eggs group GUID (in the URL) |

```bash
export TOAST_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export TOAST_CLIENT_SECRET="your-secret-here"
export TOAST_MGMT_GROUP_GUID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Run

```bash
python3 audit.py
```

Test against a few locations first:

```bash
export TOAST_LOCATION_GUIDS="guid-location-1,guid-location-2"
python3 audit.py
```

## Output

| File | Contents |
|---|---|
| `audit-report.json` | Full structured data — all locations, all raw API responses, all findings |
| `audit-report.md` | Human-readable drift summary — bring this to the renegotiation meeting |

## What it checks

- **Menu item presence drift** — items that exist at some locations but not others
- **Menu item price drift** — same item, different prices
- **Modifier presence drift** — modifier groups/options missing at some locations
- **Modifier price drift** — same modifier, different upcharge amounts
- **Revenue categories** — categories missing at some locations
- **Dining options** — missing options or behavior mismatches (dine-in/to-go/delivery config)
- **Tax rates** — same tax name, different rates across locations
- **Price groups** — pricing group assignments

## What it does NOT check (requires Toast admin UI)

- MLM inheritance structure (which menus are corporate-managed vs. local)
- Printer / KDS / prep station routing
- Employee permission assignments
- Whether local overrides are intentional exceptions
