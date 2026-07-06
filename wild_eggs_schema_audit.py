#!/usr/bin/env python3
"""
wild_eggs_schema_audit.py — Schema.org / structured-data audit for wildeggs.com

Usage:
    python3 wild_eggs_schema_audit.py                          # all locations
    python3 wild_eggs_schema_audit.py --playwright             # JS-rendered verification
    python3 wild_eggs_schema_audit.py --location wild-eggs-palomar-lexington-ky
    python3 wild_eggs_schema_audit.py --no-locations           # infra only
    python3 wild_eggs_schema_audit.py --output-dir ~/Desktop/we-audit
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table
from rich import box
from rich.text import Text
from rich.panel import Panel

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.wildeggs.com"

# All 24 known Wild Eggs locations (slug → human label)
LOCATIONS: dict[str, str] = {
    "wild-eggs-palomar-lexington-ky": "Palomar – Lexington, KY",
    "wild-eggs-hamburg-lexington-ky": "Hamburg – Lexington, KY",
    "wild-eggs-nicholasville-road-lexington-ky": "Nicholasville Rd – Lexington, KY",
    "wild-eggs-richmond-road-lexington-ky": "Richmond Rd – Lexington, KY",
    "wild-eggs-tates-creek-lexington-ky": "Tates Creek – Lexington, KY",
    "wild-eggs-chevy-chase-lexington-ky": "Chevy Chase – Lexington, KY",
    "wild-eggs-bardstown-road-louisville-ky": "Bardstown Rd – Louisville, KY",
    "wild-eggs-middletown-louisville-ky": "Middletown – Louisville, KY",
    "wild-eggs-st-matthews-louisville-ky": "St. Matthews – Louisville, KY",
    "wild-eggs-westport-road-louisville-ky": "Westport Rd – Louisville, KY",
    "wild-eggs-norton-commons-louisville-ky": "Norton Commons – Louisville, KY",
    "wild-eggs-floyd-knobs-in": "Floyd Knobs, IN",
    "wild-eggs-new-albany-in": "New Albany, IN",
    "wild-eggs-clarksville-in": "Clarksville, IN",
    "wild-eggs-jeffersonville-in": "Jeffersonville, IN",
    "wild-eggs-greenwood-in": "Greenwood, IN",
    "wild-eggs-fishers-in": "Fishers, IN",
    "wild-eggs-noblesville-in": "Noblesville, IN",
    "wild-eggs-castleton-indianapolis-in": "Castleton – Indianapolis, IN",
    "wild-eggs-avon-in": "Avon, IN",
    "wild-eggs-murfreesboro-tn": "Murfreesboro, TN",
    "wild-eggs-brentwood-tn": "Brentwood, TN",
    "wild-eggs-nashville-tn": "Nashville, TN",
    "wild-eggs-franklin-tn": "Franklin, TN",
}

# Schema types we require on location pages
REQUIRED_SCHEMA_TYPES = {"Restaurant", "LocalBusiness"}
DESIRED_SCHEMA_TYPES = {
    "BreadcrumbList",
    "WebPage",
    "WebSite",
    "Organization",
    "ImageObject",
}

# Required Restaurant / LocalBusiness properties
REQUIRED_PROPERTIES = {
    "name",
    "address",
    "telephone",
    "url",
    "servesCuisine",
    "openingHoursSpecification",
}
RECOMMENDED_PROPERTIES = {
    "image",
    "geo",
    "priceRange",
    "hasMap",
    "aggregateRating",
    "menu",
    "acceptsReservations",
    "currenciesAccepted",
    "paymentAccepted",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; WildEggsSchemaAudit/1.0; "
        "+https://github.com/ellemaculate/claude-design-system-wild-eggs)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

console = Console()


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class SchemaBlock:
    raw_type: str          # @type value
    context: str           # @context value
    data: dict
    source: str            # "json-ld" | "microdata" | "rdfa"


@dataclass
class PageResult:
    url: str
    slug: str
    label: str
    status_code: Optional[int] = None
    final_url: Optional[str] = None  # after redirects
    redirect_chain: list[str] = field(default_factory=list)
    schema_blocks: list[SchemaBlock] = field(default_factory=list)
    missing_required_types: list[str] = field(default_factory=list)
    missing_required_props: list[str] = field(default_factory=list)
    missing_recommended_props: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    js_verified: Optional[bool] = None  # None = not tested

    @property
    def passed(self) -> bool:
        return (
            self.status_code == 200
            and not self.missing_required_types
            and not self.missing_required_props
            and not self.errors
        )


@dataclass
class InfraResult:
    robots_url: str
    robots_status: Optional[int] = None
    robots_disallows: list[str] = field(default_factory=list)
    robots_sitemaps: list[str] = field(default_factory=list)
    sitemap_url: Optional[str] = None
    sitemap_status: Optional[int] = None
    sitemap_loc_count: int = 0
    sitemap_location_coverage: list[str] = field(default_factory=list)
    sitemap_missing_locations: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def get_with_retry(
    url: str,
    session: requests.Session,
    retries: int = 3,
    backoff: float = 1.5,
) -> requests.Response:
    last_exc: Optional[Exception] = None
    for attempt in range(retries):
        try:
            resp = session.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
            return resp
        except requests.RequestException as exc:
            last_exc = exc
            if attempt < retries - 1:
                time.sleep(backoff ** attempt)
    raise last_exc


def resolve_redirect_chain(url: str, session: requests.Session) -> tuple[list[str], int]:
    """Return (chain_of_urls, final_status_code)."""
    chain: list[str] = [url]
    try:
        resp = session.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
        for r in resp.history:
            chain.append(r.headers.get("Location", ""))
        chain.append(resp.url)
        chain = list(dict.fromkeys(chain))  # dedupe while preserving order
        return chain, resp.status_code
    except requests.RequestException as exc:
        return chain, 0


# ---------------------------------------------------------------------------
# Schema extraction
# ---------------------------------------------------------------------------

def extract_json_ld_blocks(soup: BeautifulSoup) -> list[SchemaBlock]:
    blocks: list[SchemaBlock] = []
    for tag in soup.find_all("script", type="application/ld+json"):
        raw = tag.string or tag.get_text()
        raw = raw.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            # Try to salvage partial JSON (strip trailing garbage)
            try:
                data = json.loads(raw[: raw.rfind("}") + 1])
            except Exception:
                continue
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    blocks.append(
                        SchemaBlock(
                            raw_type=item.get("@type", ""),
                            context=item.get("@context", ""),
                            data=item,
                            source="json-ld",
                        )
                    )
        elif isinstance(data, dict):
            # @graph support
            if "@graph" in data:
                for item in data["@graph"]:
                    if isinstance(item, dict):
                        blocks.append(
                            SchemaBlock(
                                raw_type=item.get("@type", ""),
                                context=data.get("@context", item.get("@context", "")),
                                data=item,
                                source="json-ld",
                            )
                        )
            else:
                blocks.append(
                    SchemaBlock(
                        raw_type=data.get("@type", ""),
                        context=data.get("@context", ""),
                        data=data,
                        source="json-ld",
                    )
                )
    return blocks


def normalize_type(raw_type) -> set[str]:
    """@type can be a string or list; normalize to a set of bare type names."""
    if not raw_type:
        return set()
    types = raw_type if isinstance(raw_type, list) else [raw_type]
    result = set()
    for t in types:
        # Strip schema.org namespace
        result.add(t.split("/")[-1])
    return result


def check_address(addr) -> bool:
    if isinstance(addr, dict):
        return bool(addr.get("streetAddress") or addr.get("addressLocality"))
    return bool(addr)


def check_opening_hours(oh) -> bool:
    if isinstance(oh, list):
        return len(oh) > 0 and all(
            isinstance(s, dict) and ("opens" in s or "dayOfWeek" in s) for s in oh
        )
    return bool(oh)


def validate_block(block: SchemaBlock, types: set[str]) -> tuple[list[str], list[str]]:
    """Return (missing_required, missing_recommended) for a Restaurant/LocalBusiness block."""
    d = block.data
    missing_req: list[str] = []
    missing_rec: list[str] = []

    checks: dict[str, callable] = {
        "name": lambda d: bool(d.get("name")),
        "address": lambda d: check_address(d.get("address")),
        "telephone": lambda d: bool(d.get("telephone")),
        "url": lambda d: bool(d.get("url")),
        "servesCuisine": lambda d: bool(d.get("servesCuisine")),
        "openingHoursSpecification": lambda d: check_opening_hours(
            d.get("openingHoursSpecification") or d.get("openingHours")
        ),
    }
    rec_checks: dict[str, callable] = {
        "image": lambda d: bool(d.get("image")),
        "geo": lambda d: bool(d.get("geo")),
        "priceRange": lambda d: bool(d.get("priceRange")),
        "hasMap": lambda d: bool(d.get("hasMap")),
        "aggregateRating": lambda d: bool(d.get("aggregateRating")),
        "menu": lambda d: bool(d.get("menu") or d.get("hasMenu")),
        "acceptsReservations": lambda d: "acceptsReservations" in d,
        "currenciesAccepted": lambda d: bool(d.get("currenciesAccepted")),
        "paymentAccepted": lambda d: bool(d.get("paymentAccepted")),
    }

    for prop, fn in checks.items():
        if not fn(d):
            missing_req.append(prop)

    for prop, fn in rec_checks.items():
        if not fn(d):
            missing_rec.append(prop)

    return missing_req, missing_rec


# ---------------------------------------------------------------------------
# Playwright JS verification
# ---------------------------------------------------------------------------

def verify_with_playwright(url: str) -> tuple[list[SchemaBlock], list[str]]:
    """Render page with Chromium, extract JSON-LD from rendered DOM."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return [], ["playwright not installed"]

    blocks: list[SchemaBlock] = []
    errors: list[str] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                executable_path="/opt/pw-browsers/chromium",
            )
            page = browser.new_page()
            page.goto(url, wait_until="networkidle", timeout=30000)
            html = page.content()
            browser.close()

        soup = BeautifulSoup(html, "lxml")
        blocks = extract_json_ld_blocks(soup)
    except Exception as exc:
        errors.append(f"Playwright error: {exc}")

    return blocks, errors


# ---------------------------------------------------------------------------
# Infrastructure audit
# ---------------------------------------------------------------------------

def audit_infrastructure(session: requests.Session) -> InfraResult:
    result = InfraResult(robots_url=f"{BASE_URL}/robots.txt")

    # --- robots.txt ---
    try:
        resp = get_with_retry(f"{BASE_URL}/robots.txt", session)
        result.robots_status = resp.status_code
        if resp.status_code == 200:
            for line in resp.text.splitlines():
                line = line.strip()
                if line.lower().startswith("disallow:"):
                    val = line.split(":", 1)[1].strip()
                    if val:
                        result.robots_disallows.append(val)
                elif line.lower().startswith("sitemap:"):
                    val = line.split(":", 1)[1].strip()
                    if val:
                        result.robots_sitemaps.append(val)
        else:
            result.errors.append(f"robots.txt returned HTTP {resp.status_code}")
    except Exception as exc:
        result.errors.append(f"robots.txt fetch failed: {exc}")

    # --- sitemap ---
    sitemap_candidates = list(result.robots_sitemaps) or [f"{BASE_URL}/sitemap.xml"]
    for candidate in sitemap_candidates:
        try:
            resp = get_with_retry(candidate, session)
            if resp.status_code == 200:
                result.sitemap_url = candidate
                result.sitemap_status = resp.status_code
                # Parse sitemap (may be sitemap index or plain sitemap)
                soup = BeautifulSoup(resp.content, "xml")
                locs = [tag.get_text(strip=True) for tag in soup.find_all("loc")]
                result.sitemap_loc_count = len(locs)

                # Resolve nested sitemaps (index)
                if soup.find("sitemapindex"):
                    all_locs: list[str] = []
                    for sub_url in locs:
                        try:
                            sub_resp = get_with_retry(sub_url, session)
                            if sub_resp.status_code == 200:
                                sub_soup = BeautifulSoup(sub_resp.content, "xml")
                                all_locs.extend(
                                    t.get_text(strip=True)
                                    for t in sub_soup.find_all("loc")
                                )
                        except Exception:
                            pass
                    locs = all_locs
                    result.sitemap_loc_count = len(locs)

                # Check location coverage
                for slug in LOCATIONS:
                    if any(slug in loc for loc in locs):
                        result.sitemap_location_coverage.append(slug)
                    else:
                        result.sitemap_missing_locations.append(slug)
                break
        except Exception as exc:
            result.errors.append(f"Sitemap fetch failed ({candidate}): {exc}")

    if not result.sitemap_url:
        result.errors.append("No accessible sitemap found")

    return result


# ---------------------------------------------------------------------------
# Location page audit
# ---------------------------------------------------------------------------

def audit_location(
    slug: str,
    label: str,
    session: requests.Session,
    use_playwright: bool = False,
) -> PageResult:
    url = f"{BASE_URL}/locations/{slug}/"
    result = PageResult(url=url, slug=slug, label=label)

    # Fetch page
    try:
        resp = get_with_retry(url, session)
        result.status_code = resp.status_code
        result.final_url = resp.url
        result.redirect_chain = [r.url for r in resp.history] + [resp.url]
    except requests.RequestException as exc:
        result.errors.append(f"Fetch failed: {exc}")
        result.status_code = 0
        return result

    if resp.status_code != 200:
        result.errors.append(f"HTTP {resp.status_code}")
        return result

    # Parse HTML
    soup = BeautifulSoup(resp.content, "lxml")

    # Extract JSON-LD
    result.schema_blocks = extract_json_ld_blocks(soup)

    # JS-rendered verification
    if use_playwright:
        pw_blocks, pw_errors = verify_with_playwright(result.final_url or url)
        result.js_verified = bool(pw_blocks) and not pw_errors
        if pw_errors:
            result.errors.extend(pw_errors)
        # Merge any extra blocks found only in rendered DOM
        existing_types = {b.raw_type for b in result.schema_blocks}
        for b in pw_blocks:
            if b.raw_type not in existing_types:
                result.schema_blocks.append(b)
                result.warnings.append(
                    f"Schema type '{b.raw_type}' only present in JS-rendered DOM"
                )

    # Determine which schema types are present
    present_types: set[str] = set()
    for block in result.schema_blocks:
        present_types.update(normalize_type(block.raw_type))

    # Check required schema types
    result.missing_required_types = sorted(
        REQUIRED_SCHEMA_TYPES - present_types
    )

    # Validate required + recommended properties on Restaurant/LocalBusiness blocks
    for block in result.schema_blocks:
        btypes = normalize_type(block.raw_type)
        if btypes & (REQUIRED_SCHEMA_TYPES | {"FoodEstablishment"}):
            missing_req, missing_rec = validate_block(block, btypes)
            result.missing_required_props = missing_req
            result.missing_recommended_props = missing_rec
            break  # validate first matching block

    # Canonical check
    canonical = soup.find("link", rel="canonical")
    if canonical:
        canon_href = canonical.get("href", "")
        if slug not in canon_href:
            result.warnings.append(
                f"Canonical '{canon_href}' does not contain slug '{slug}'"
            )
    else:
        result.warnings.append("No canonical tag found")

    # title tag
    title = soup.find("title")
    if not title or not title.get_text(strip=True):
        result.warnings.append("Missing <title> tag")

    # meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if not meta_desc or not meta_desc.get("content", "").strip():
        result.warnings.append("Missing meta description")

    return result


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def render_infra_panel(infra: InfraResult) -> None:
    table = Table(box=box.SIMPLE_HEAD, show_header=False, padding=(0, 1))
    table.add_column("Key", style="bold cyan", no_wrap=True)
    table.add_column("Value")

    # robots.txt
    robots_status = f"HTTP {infra.robots_status}" if infra.robots_status else "FAILED"
    robots_color = "green" if infra.robots_status == 200 else "red"
    table.add_row("robots.txt", Text(robots_status, style=robots_color))
    if infra.robots_sitemaps:
        table.add_row("  Sitemap directives", ", ".join(infra.robots_sitemaps))
    if infra.robots_disallows:
        table.add_row(
            "  Disallow rules",
            f"{len(infra.robots_disallows)} rule(s): {', '.join(infra.robots_disallows[:5])}{'…' if len(infra.robots_disallows) > 5 else ''}",
        )

    # sitemap
    if infra.sitemap_url:
        sitemap_color = "green" if infra.sitemap_status == 200 else "red"
        table.add_row("sitemap", Text(f"{infra.sitemap_url}  HTTP {infra.sitemap_status}", style=sitemap_color))
        table.add_row("  total URLs", str(infra.sitemap_loc_count))
        cov = len(infra.sitemap_location_coverage)
        total = len(LOCATIONS)
        cov_color = "green" if cov == total else ("yellow" if cov > 0 else "red")
        table.add_row("  location coverage", Text(f"{cov}/{total}", style=cov_color))
        if infra.sitemap_missing_locations:
            table.add_row(
                "  missing slugs",
                "\n".join(infra.sitemap_missing_locations[:5])
                + (f"\n…+{len(infra.sitemap_missing_locations)-5} more" if len(infra.sitemap_missing_locations) > 5 else ""),
            )
    else:
        table.add_row("sitemap", Text("NOT FOUND", style="red"))

    for err in infra.errors:
        table.add_row("  ERROR", Text(err, style="red"))

    console.print(Panel(table, title="[bold]Infrastructure[/bold]", border_style="blue"))


def render_location_summary(results: list[PageResult]) -> None:
    table = Table(
        title="Location Schema Audit",
        box=box.ROUNDED,
        show_lines=False,
        header_style="bold white on #222266",
    )
    table.add_column("#", justify="right", style="dim", width=3)
    table.add_column("Location", no_wrap=True)
    table.add_column("HTTP", justify="center", width=6)
    table.add_column("Schema types", no_wrap=False)
    table.add_column("Missing req. props", no_wrap=False)
    table.add_column("JS verified", justify="center", width=10)
    table.add_column("Status", justify="center", width=8)

    for i, r in enumerate(results, 1):
        http_color = "green" if r.status_code == 200 else "red"
        http_text = Text(str(r.status_code or "ERR"), style=http_color)

        present = {t for b in r.schema_blocks for t in normalize_type(b.raw_type)}
        types_text = ", ".join(sorted(present)) if present else Text("none", style="red")

        miss_req = ", ".join(r.missing_required_props) if r.missing_required_props else ""
        miss_req_text = Text(miss_req, style="yellow") if miss_req else Text("✓", style="green")

        if r.js_verified is None:
            js_text = Text("—", style="dim")
        elif r.js_verified:
            js_text = Text("✓", style="green")
        else:
            js_text = Text("✗", style="red")

        if r.passed:
            status = Text("PASS", style="bold green")
        elif r.errors:
            status = Text("FAIL", style="bold red")
        else:
            status = Text("WARN", style="bold yellow")

        table.add_row(
            str(i),
            r.label,
            http_text,
            types_text,
            miss_req_text,
            js_text,
            status,
        )

    console.print(table)


def render_detail_panels(results: list[PageResult]) -> None:
    issues = [r for r in results if not r.passed or r.warnings]
    if not issues:
        console.print("[bold green]All locations passed with no issues![/bold green]")
        return

    console.print(f"\n[bold]Detail: {len(issues)} location(s) with issues[/bold]\n")
    for r in issues:
        lines: list[str] = []
        lines.append(f"[dim]{r.url}[/dim]")
        if r.status_code != 200:
            lines.append(f"[red]HTTP {r.status_code}[/red]")
        if r.redirect_chain and len(r.redirect_chain) > 1:
            lines.append(f"[dim]Redirect chain:[/dim] {' → '.join(r.redirect_chain)}")
        if r.missing_required_types:
            lines.append(f"[red]Missing schema types:[/red] {', '.join(r.missing_required_types)}")
        if r.missing_required_props:
            lines.append(f"[red]Missing required props:[/red] {', '.join(r.missing_required_props)}")
        if r.missing_recommended_props:
            lines.append(f"[yellow]Missing recommended props:[/yellow] {', '.join(r.missing_recommended_props)}")
        for e in r.errors:
            lines.append(f"[red]Error:[/red] {e}")
        for w in r.warnings:
            lines.append(f"[yellow]Warning:[/yellow] {w}")

        border = "red" if r.errors else "yellow"
        console.print(
            Panel(
                "\n".join(lines),
                title=f"[bold]{r.label}[/bold]",
                border_style=border,
                expand=False,
            )
        )


# ---------------------------------------------------------------------------
# JSON report
# ---------------------------------------------------------------------------

def build_json_report(
    infra: Optional[InfraResult],
    results: list[PageResult],
) -> dict:
    report: dict = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": BASE_URL,
        "summary": {
            "locations_audited": len(results),
            "passed": sum(1 for r in results if r.passed),
            "failed": sum(1 for r in results if not r.passed),
        },
    }
    if infra:
        report["infrastructure"] = {
            "robots_status": infra.robots_status,
            "robots_disallows": infra.robots_disallows,
            "robots_sitemaps": infra.robots_sitemaps,
            "sitemap_url": infra.sitemap_url,
            "sitemap_status": infra.sitemap_status,
            "sitemap_loc_count": infra.sitemap_loc_count,
            "sitemap_location_coverage_count": len(infra.sitemap_location_coverage),
            "sitemap_missing_locations": infra.sitemap_missing_locations,
            "errors": infra.errors,
        }
    report["locations"] = [
        {
            "slug": r.slug,
            "label": r.label,
            "url": r.url,
            "final_url": r.final_url,
            "status_code": r.status_code,
            "redirect_chain": r.redirect_chain,
            "schema_types_present": sorted(
                {t for b in r.schema_blocks for t in normalize_type(b.raw_type)}
            ),
            "missing_required_types": r.missing_required_types,
            "missing_required_props": r.missing_required_props,
            "missing_recommended_props": r.missing_recommended_props,
            "errors": r.errors,
            "warnings": r.warnings,
            "passed": r.passed,
            "js_verified": r.js_verified,
            "schema_blocks": [
                {"type": b.raw_type, "context": b.context, "source": b.source}
                for b in r.schema_blocks
            ],
        }
        for r in results
    ]
    return report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Schema.org audit tool for wildeggs.com",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--playwright",
        action="store_true",
        help="Verify schema presence in JS-rendered DOM via Playwright/Chromium",
    )
    parser.add_argument(
        "--location",
        metavar="SLUG",
        help="Audit a single location by slug (e.g. wild-eggs-palomar-lexington-ky)",
    )
    parser.add_argument(
        "--no-locations",
        action="store_true",
        dest="no_locations",
        help="Skip location page audits; only run infrastructure checks",
    )
    parser.add_argument(
        "--output-dir",
        metavar="DIR",
        default="./we-audit-output",
        help="Directory to write JSON report (default: ./we-audit-output)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.max_redirects = 10

    console.rule("[bold blue]Wild Eggs Schema Audit[/bold blue]")
    console.print(f"[dim]Target: {BASE_URL}[/dim]")
    console.print(f"[dim]Output: {output_dir.resolve()}[/dim]\n")

    # --- Infrastructure ---
    infra: Optional[InfraResult] = None
    console.print("[bold]Auditing infrastructure…[/bold]")
    infra = audit_infrastructure(session)
    render_infra_panel(infra)

    if args.no_locations:
        report = build_json_report(infra, [])
        report_path = output_dir / "schema-audit-infra.json"
        report_path.write_text(json.dumps(report, indent=2))
        console.print(f"\nReport saved → [bold]{report_path}[/bold]")
        return 0

    # --- Location pages ---
    if args.location:
        if args.location not in LOCATIONS:
            console.print(
                f"[red]Unknown slug:[/red] '{args.location}'\n"
                f"Known slugs:\n" + "\n".join(f"  {s}" for s in sorted(LOCATIONS))
            )
            return 1
        slugs_to_audit = {args.location: LOCATIONS[args.location]}
    else:
        slugs_to_audit = LOCATIONS

    results: list[PageResult] = []
    console.print(f"\n[bold]Auditing {len(slugs_to_audit)} location page(s)…[/bold]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("Fetching…", total=len(slugs_to_audit))
        for slug, label in slugs_to_audit.items():
            progress.update(task, description=f"[cyan]{label}[/cyan]")
            result = audit_location(slug, label, session, use_playwright=args.playwright)
            results.append(result)
            progress.advance(task)

    # --- Display ---
    console.print()
    render_location_summary(results)
    render_detail_panels(results)

    # --- Summary line ---
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    color = "green" if passed == total else ("yellow" if passed > 0 else "red")
    console.print(
        f"\n[bold {color}]{passed}/{total} location(s) passed[/bold {color}]"
    )

    # --- Save report ---
    report = build_json_report(infra, results)
    timestamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    report_path = output_dir / f"schema-audit-{timestamp}.json"
    report_path.write_text(json.dumps(report, indent=2))
    console.print(f"Report saved → [bold]{report_path}[/bold]")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
