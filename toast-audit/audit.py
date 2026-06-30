#!/usr/bin/env python3
"""
Wild Eggs — Toast MLM Audit Script
===================================
Pulls menu, pricing, modifier, revenue center, dining option, and tax data
across all locations in the Wild Eggs management group, then produces a
structured JSON report and human-readable summary of all drift.

Usage:
    export TOAST_CLIENT_ID="your-client-id"
    export TOAST_CLIENT_SECRET="your-client-secret"
    export TOAST_MGMT_GROUP_GUID="your-management-group-guid"
    python3 audit.py

    # Optional: limit to specific location GUIDs for a quick test run
    export TOAST_LOCATION_GUIDS="guid1,guid2,guid3"

Output:
    audit-report.json   — full structured data, all locations
    audit-report.md     — human-readable drift summary
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from collections import defaultdict


# ── Configuration ─────────────────────────────────────────────────────────────

BASE_URL       = "https://ws-api.toasttab.com"
AUTH_URL       = f"{BASE_URL}/authentication/v1/authentication/login"
MGMT_URL       = f"{BASE_URL}/restaurants/v1/groups"
MENUS_URL      = f"{BASE_URL}/menus/v3/menus"
CONFIG_URL     = f"{BASE_URL}/config/v2"

CLIENT_ID      = os.environ.get("TOAST_CLIENT_ID", "")
CLIENT_SECRET  = os.environ.get("TOAST_CLIENT_SECRET", "")
MGMT_GUID      = os.environ.get("TOAST_MGMT_GROUP_GUID", "")
LOCATION_FILTER = [g.strip() for g in os.environ.get("TOAST_LOCATION_GUIDS", "").split(",") if g.strip()]

# Retry settings
MAX_RETRIES    = 4
RETRY_DELAYS   = [2, 4, 8, 16]
REQUEST_PAUSE  = 0.25  # seconds between calls — stay well inside rate limits


# ── Authentication ─────────────────────────────────────────────────────────────

def get_token():
    """Authenticate and return a management-scoped Bearer token."""
    if not CLIENT_ID or not CLIENT_SECRET:
        sys.exit("ERROR: TOAST_CLIENT_ID and TOAST_CLIENT_SECRET must be set.")

    payload = {
        "clientId": CLIENT_ID,
        "clientSecret": CLIENT_SECRET,
        "userAccessType": "TOAST_MACHINE_CLIENT"
    }
    resp = _post(AUTH_URL, json=payload, headers={"Content-Type": "application/json"}, auth=False)
    token = resp.get("token", {}).get("accessToken")
    if not token:
        sys.exit(f"ERROR: Authentication failed. Response: {resp}")
    return token


# ── Location discovery ─────────────────────────────────────────────────────────

def get_locations(token):
    """Return list of {guid, name} for all locations in the management group."""
    if not MGMT_GUID:
        sys.exit("ERROR: TOAST_MGMT_GROUP_GUID must be set.")

    headers = auth_headers(token)
    url = f"{MGMT_URL}/{MGMT_GUID}/restaurants"
    data = _get(url, headers=headers)

    locations = []
    for r in data:
        guid = r.get("restaurantGuid") or r.get("guid")
        name = r.get("restaurantName") or r.get("name") or guid
        if LOCATION_FILTER and guid not in LOCATION_FILTER:
            continue
        locations.append({"guid": guid, "name": name})

    if not locations:
        sys.exit("ERROR: No locations found. Check TOAST_MGMT_GROUP_GUID and permissions.")

    print(f"  Found {len(locations)} location(s).")
    return locations


# ── Per-location data pull ─────────────────────────────────────────────────────

def pull_location(token, location):
    """Pull all audit-relevant data for one location. Returns a dict."""
    guid = location["guid"]
    name = location["name"]
    headers = {**auth_headers(token), "Toast-Restaurant-External-ID": guid}

    print(f"    Pulling: {name} ({guid})")

    result = {
        "guid": guid,
        "name": name,
        "menus":            safe_get(f"{MENUS_URL}", headers),
        "menu_groups":      safe_get(f"{BASE_URL}/menus/v2/menuGroups", headers),
        "menu_items":       safe_get(f"{BASE_URL}/menus/v2/menuItems", headers),
        "modifier_groups":  safe_get(f"{BASE_URL}/menus/v2/modifierGroups", headers),
        "modifiers":        safe_get(f"{BASE_URL}/menus/v2/modifiers", headers),
        "revenue_cats":     safe_get(f"{CONFIG_URL}/revenueCategories", headers),
        "dining_options":   safe_get(f"{CONFIG_URL}/diningOptions", headers),
        "taxes":            safe_get(f"{CONFIG_URL}/taxes", headers),
        "price_groups":     safe_get(f"{CONFIG_URL}/priceGroups", headers),
        "service_areas":    safe_get(f"{CONFIG_URL}/serviceAreas", headers),
    }
    return result


# ── Comparison / analysis ──────────────────────────────────────────────────────

def analyze(locations_data):
    """
    Cross-compare all locations. Returns a findings dict structured as:
      {
        "menu_items": { "drift": [...], "pricing_diff": [...] },
        "modifiers":  { "drift": [...], "pricing_diff": [...] },
        "revenue_cats": { "drift": [...] },
        "dining_options": { "drift": [...] },
        "taxes": { "drift": [...] },
        "summary": { ... }
      }
    """
    findings = {
        "menu_items":    {"drift": [], "pricing_diff": []},
        "modifiers":     {"drift": [], "pricing_diff": []},
        "revenue_cats":  {"drift": []},
        "dining_options":{"drift": []},
        "taxes":         {"drift": []},
        "price_groups":  {"drift": []},
        "summary":       {},
    }

    # Build cross-location indexes
    item_index    = defaultdict(dict)  # name → {location_guid: item_data}
    mod_index     = defaultdict(dict)
    rev_index     = defaultdict(dict)
    dining_index  = defaultdict(dict)
    tax_index     = defaultdict(dict)
    pg_index      = defaultdict(dict)

    for loc in locations_data:
        lguid = loc["guid"]
        lname = loc["name"]

        for item in _ensure_list(loc.get("menu_items")):
            key = _item_key(item)
            item_index[key][lguid] = {"name": lname, "price": _price(item), "visible": _visible(item), "mlm_inherited": item.get("inheritedFromParent", None)}

        for mod in _ensure_list(loc.get("modifiers")):
            key = _item_key(mod)
            mod_index[key][lguid] = {"name": lname, "price": _price(mod), "visible": _visible(mod)}

        for rc in _ensure_list(loc.get("revenue_cats")):
            key = rc.get("name", "")
            rev_index[key][lguid] = {"name": lname, "guid": rc.get("guid")}

        for do in _ensure_list(loc.get("dining_options")):
            key = do.get("name", "")
            dining_index[key][lguid] = {"name": lname, "guid": do.get("guid"), "behavior": do.get("behavior")}

        for tax in _ensure_list(loc.get("taxes")):
            key = tax.get("name", "")
            tax_index[key][lguid] = {"name": lname, "rate": tax.get("rate"), "guid": tax.get("guid")}

        for pg in _ensure_list(loc.get("price_groups")):
            key = pg.get("name", "")
            pg_index[key][lguid] = {"name": lname, "guid": pg.get("guid")}

    all_guids = {loc["guid"] for loc in locations_data}

    # 1. Menu items — presence drift
    for item_name, by_loc in item_index.items():
        missing = all_guids - set(by_loc.keys())
        if missing:
            findings["menu_items"]["drift"].append({
                "item": item_name,
                "present_at": [by_loc[g]["name"] for g in by_loc],
                "missing_at": [_loc_name(locations_data, g) for g in missing],
                "count_present": len(by_loc),
                "count_missing": len(missing),
            })

    # 2. Menu items — price drift
    for item_name, by_loc in item_index.items():
        prices = {g: d["price"] for g, d in by_loc.items() if d["price"] is not None}
        unique_prices = set(prices.values())
        if len(unique_prices) > 1:
            findings["menu_items"]["pricing_diff"].append({
                "item": item_name,
                "prices": {by_loc[g]["name"]: prices[g] for g in prices},
                "min": min(unique_prices),
                "max": max(unique_prices),
                "spread": round(max(unique_prices) - min(unique_prices), 2),
            })

    # 3. Modifiers — presence drift
    for mod_name, by_loc in mod_index.items():
        missing = all_guids - set(by_loc.keys())
        if missing:
            findings["modifiers"]["drift"].append({
                "modifier": mod_name,
                "present_at": [by_loc[g]["name"] for g in by_loc],
                "missing_at": [_loc_name(locations_data, g) for g in missing],
            })

    # 4. Modifiers — price drift
    for mod_name, by_loc in mod_index.items():
        prices = {g: d["price"] for g, d in by_loc.items() if d["price"] is not None}
        unique_prices = set(prices.values())
        if len(unique_prices) > 1:
            findings["modifiers"]["pricing_diff"].append({
                "modifier": mod_name,
                "prices": {by_loc[g]["name"]: prices[g] for g in prices},
                "spread": round(max(unique_prices) - min(unique_prices), 2),
            })

    # 5. Revenue categories drift
    for rc_name, by_loc in rev_index.items():
        missing = all_guids - set(by_loc.keys())
        if missing:
            findings["revenue_cats"]["drift"].append({
                "category": rc_name,
                "missing_at": [_loc_name(locations_data, g) for g in missing],
            })

    # 6. Dining options drift
    for do_name, by_loc in dining_index.items():
        missing = all_guids - set(by_loc.keys())
        if missing:
            findings["dining_options"]["drift"].append({
                "option": do_name,
                "missing_at": [_loc_name(locations_data, g) for g in missing],
            })
        # Flag behavior inconsistencies
        behaviors = {d["behavior"] for d in by_loc.values() if d.get("behavior")}
        if len(behaviors) > 1:
            findings["dining_options"]["drift"].append({
                "option": do_name,
                "issue": "behavior_mismatch",
                "behaviors": {by_loc[g]["name"]: by_loc[g].get("behavior") for g in by_loc},
            })

    # 7. Tax drift
    for tax_name, by_loc in tax_index.items():
        rates = {d["rate"] for d in by_loc.values() if d.get("rate") is not None}
        if len(rates) > 1:
            findings["taxes"]["drift"].append({
                "tax": tax_name,
                "rates": {by_loc[g]["name"]: by_loc[g]["rate"] for g in by_loc},
            })
        missing = all_guids - set(by_loc.keys())
        if missing:
            findings["taxes"]["drift"].append({
                "tax": tax_name,
                "issue": "missing_at_locations",
                "missing_at": [_loc_name(locations_data, g) for g in missing],
            })

    # 8. Summary counts
    findings["summary"] = {
        "locations_audited":        len(locations_data),
        "menu_items_total":         len(item_index),
        "menu_items_with_drift":    len(findings["menu_items"]["drift"]),
        "menu_items_with_price_diff": len(findings["menu_items"]["pricing_diff"]),
        "modifiers_total":          len(mod_index),
        "modifiers_with_drift":     len(findings["modifiers"]["drift"]),
        "modifiers_with_price_diff":len(findings["modifiers"]["pricing_diff"]),
        "revenue_cats_with_drift":  len(findings["revenue_cats"]["drift"]),
        "dining_options_with_drift":len(findings["dining_options"]["drift"]),
        "tax_issues":               len(findings["taxes"]["drift"]),
        "generated_at":             datetime.utcnow().isoformat() + "Z",
    }

    return findings


# ── Report generation ──────────────────────────────────────────────────────────

def write_json_report(locations_data, findings, path="audit-report.json"):
    report = {
        "meta": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "locations": [{"guid": l["guid"], "name": l["name"]} for l in locations_data],
        },
        "findings": findings,
        "raw": {l["guid"]: {k: v for k, v in l.items() if k not in ("guid", "name")} for l in locations_data},
    }
    with open(path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"  JSON report written → {path}")


def write_md_report(findings, path="audit-report.md"):
    s = findings["summary"]
    lines = [
        "# Wild Eggs — Toast MLM Audit Report",
        f"Generated: {s['generated_at']}",
        "",
        "## Summary",
        f"| | |",
        f"|---|---|",
        f"| Locations audited | **{s['locations_audited']}** |",
        f"| Menu items (total) | {s['menu_items_total']} |",
        f"| Menu items with presence drift | **{s['menu_items_with_drift']}** |",
        f"| Menu items with price differences | **{s['menu_items_with_price_diff']}** |",
        f"| Modifiers with presence drift | **{s['modifiers_with_drift']}** |",
        f"| Modifiers with price differences | **{s['modifiers_with_price_diff']}** |",
        f"| Revenue category issues | **{s['revenue_cats_with_drift']}** |",
        f"| Dining option issues | **{s['dining_options_with_drift']}** |",
        f"| Tax rate inconsistencies | **{s['tax_issues']}** |",
        "",
    ]

    # Menu item drift
    if findings["menu_items"]["drift"]:
        lines.append("## Menu Items — Presence Drift")
        lines.append("Items that exist at some locations but not others.\n")
        lines.append("| Item | Present at | Missing at |")
        lines.append("|---|---|---|")
        # Sort by most locations missing first
        for d in sorted(findings["menu_items"]["drift"], key=lambda x: x["count_missing"], reverse=True)[:50]:
            present = ", ".join(d["present_at"][:3]) + (f" +{len(d['present_at'])-3}" if len(d["present_at"]) > 3 else "")
            missing = ", ".join(d["missing_at"][:3]) + (f" +{len(d['missing_at'])-3}" if len(d["missing_at"]) > 3 else "")
            lines.append(f"| {d['item']} | {present} | {missing} |")
        if len(findings["menu_items"]["drift"]) > 50:
            lines.append(f"\n_...and {len(findings['menu_items']['drift']) - 50} more. See audit-report.json for full list._")
        lines.append("")

    # Menu item price drift
    if findings["menu_items"]["pricing_diff"]:
        lines.append("## Menu Items — Price Differences")
        lines.append("Same item, different prices across locations.\n")
        lines.append("| Item | Min | Max | Spread | Locations |")
        lines.append("|---|---|---|---|---|")
        for d in sorted(findings["menu_items"]["pricing_diff"], key=lambda x: x["spread"], reverse=True)[:50]:
            loc_prices = "; ".join(f"{loc}: ${price:.2f}" for loc, price in list(d["prices"].items())[:4])
            lines.append(f"| {d['item']} | ${d['min']:.2f} | ${d['max']:.2f} | **${d['spread']:.2f}** | {loc_prices} |")
        lines.append("")

    # Modifier drift
    if findings["modifiers"]["drift"]:
        lines.append("## Modifiers — Presence Drift")
        lines.append("| Modifier | Missing at |")
        lines.append("|---|---|")
        for d in findings["modifiers"]["drift"][:50]:
            missing = ", ".join(d["missing_at"][:4])
            lines.append(f"| {d['modifier']} | {missing} |")
        lines.append("")

    # Modifier price drift
    if findings["modifiers"]["pricing_diff"]:
        lines.append("## Modifiers — Price Differences")
        lines.append("| Modifier | Spread | Locations |")
        lines.append("|---|---|---|")
        for d in sorted(findings["modifiers"]["pricing_diff"], key=lambda x: x["spread"], reverse=True)[:50]:
            loc_prices = "; ".join(f"{loc}: ${price:.2f}" for loc, price in list(d["prices"].items())[:4])
            lines.append(f"| {d['modifier']} | **${d['spread']:.2f}** | {loc_prices} |")
        lines.append("")

    # Revenue categories
    if findings["revenue_cats"]["drift"]:
        lines.append("## Revenue Categories — Drift")
        lines.append("| Category | Missing at |")
        lines.append("|---|---|")
        for d in findings["revenue_cats"]["drift"]:
            lines.append(f"| {d['category']} | {', '.join(d['missing_at'])} |")
        lines.append("")

    # Dining options
    if findings["dining_options"]["drift"]:
        lines.append("## Dining Options — Issues")
        lines.append("| Option | Issue |")
        lines.append("|---|---|")
        for d in findings["dining_options"]["drift"]:
            issue = d.get("issue", "missing_at_locations")
            detail = ", ".join(d.get("missing_at", [])) if issue == "missing_at_locations" else str(d.get("behaviors", ""))
            lines.append(f"| {d['option']} | {issue}: {detail} |")
        lines.append("")

    # Tax issues
    if findings["taxes"]["drift"]:
        lines.append("## Tax Rate Inconsistencies")
        lines.append("| Tax | Issue |")
        lines.append("|---|---|")
        for d in findings["taxes"]["drift"]:
            if d.get("rates"):
                rates_str = ", ".join(f"{loc}: {rate}%" for loc, rate in list(d["rates"].items())[:4])
                lines.append(f"| {d['tax']} | Rate mismatch: {rates_str} |")
            else:
                lines.append(f"| {d['tax']} | Missing at: {', '.join(d.get('missing_at', []))} |")
        lines.append("")

    lines.append("---")
    lines.append("_Generated by Wild Eggs Toast MLM Audit Script — audit.py_")

    with open(path, "w") as f:
        f.write("\n".join(lines))
    print(f"  Markdown report written → {path}")


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def auth_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _get(url, headers, params=None):
    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            r = requests.get(url, headers=headers, params=params, timeout=30)
            if r.status_code == 429:
                print(f"    Rate limited — waiting {delay or 5}s...")
                time.sleep(delay or 5)
                continue
            r.raise_for_status()
            return r.json()
        except requests.exceptions.HTTPError as e:
            if attempt == MAX_RETRIES:
                raise
            print(f"    HTTP error {e.response.status_code}, retrying ({attempt+1}/{MAX_RETRIES})...")
        except requests.exceptions.RequestException as e:
            if attempt == MAX_RETRIES:
                raise
            print(f"    Request error: {e}, retrying ({attempt+1}/{MAX_RETRIES})...")
    return []


def _post(url, json=None, headers=None, auth=True):
    r = requests.post(url, json=json, headers=headers or {}, timeout=30)
    r.raise_for_status()
    return r.json()


def safe_get(url, headers):
    """GET with error capture — returns [] on non-fatal errors so one bad endpoint doesn't abort."""
    try:
        time.sleep(REQUEST_PAUSE)
        return _get(url, headers)
    except Exception as e:
        print(f"    WARNING: {url} failed — {e}")
        return []


def _ensure_list(val):
    if val is None:
        return []
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        # Toast wraps some responses in {"results": [...]} or similar
        for k in ("results", "menus", "menuGroups", "menuItems", "modifiers", "modifierGroups"):
            if k in val:
                return val[k]
    return []


def _item_key(item):
    """Stable cross-location key for a menu item or modifier."""
    # Prefer name for cross-location comparison; GUID changes per location for non-inherited items
    return item.get("name", item.get("guid", "unknown"))


def _price(item):
    """Extract the base price from a menu item or modifier."""
    price = item.get("price")
    if price is not None:
        return float(price)
    # Some versions nest under pricingRules
    rules = item.get("pricingRules", [])
    if rules and isinstance(rules, list) and rules[0].get("price") is not None:
        return float(rules[0]["price"])
    return None


def _visible(item):
    return item.get("visibility", item.get("visible", True))


def _loc_name(locations_data, guid):
    for loc in locations_data:
        if loc["guid"] == guid:
            return loc["name"]
    return guid


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("\nWild Eggs — Toast MLM Audit")
    print("=" * 40)

    # STAGE 1: Authenticate
    print("\n[1/4] Authenticating...")
    token = get_token()
    print("  Token obtained.")

    # STAGE 2: Discover locations
    print("\n[2/4] Discovering locations...")
    locations = get_locations(token)

    # STAGE 3: Pull data per location
    print("\n[3/4] Pulling location data...")
    locations_data = []
    for loc in locations:
        data = pull_location(token, loc)
        locations_data.append(data)

    # STAGE 4: Analyze and report
    print("\n[4/4] Analyzing drift across locations...")
    findings = analyze(locations_data)

    s = findings["summary"]
    print(f"\n  Items with presence drift:  {s['menu_items_with_drift']}")
    print(f"  Items with price drift:     {s['menu_items_with_price_diff']}")
    print(f"  Modifier issues:            {s['modifiers_with_drift'] + s['modifiers_with_price_diff']}")
    print(f"  Revenue / dining / tax:     {s['revenue_cats_with_drift'] + s['dining_options_with_drift'] + s['tax_issues']}")

    print("\nWriting reports...")
    write_json_report(locations_data, findings)
    write_md_report(findings)

    print("\nDone. Review audit-report.md for the human-readable summary.")
    print("Share audit-report.json with the consultant to cut discovery time.\n")


if __name__ == "__main__":
    main()
