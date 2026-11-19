"""Install the plugin and its missing provider prices using stock New API RC51."""

import argparse
import base64
import getpass
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site")
    parser.add_argument("--user-id", required=True, type=int)
    args = parser.parse_args()
    site = args.site.rstrip("/")
    u = urlsplit(site)
    local = u.scheme == "http" and u.hostname in ("127.0.0.1", "::1", "localhost")
    if not u.hostname or u.username or u.password or u.query or u.fragment or not (u.scheme == "https" or local):
        parser.error("use the HTTPS gateway address (HTTP is allowed on localhost)")
    token = os.environ.get("NEWAPI_ADMIN_TOKEN") or getpass.getpass("New API administrator access token: ")
    http = build_opener(NoRedirect())
    def api(method, path, body=None):
        req = Request(site + path, method=method,
                      data=None if body is None else json.dumps(body).encode(),
                      headers={"Authorization": "Bearer " + token, "New-Api-User": str(args.user_id),
                               "Content-Type": "application/json", "Accept": "application/json"})
        try:
            with http.open(req, timeout=45) as response:
                payload = json.load(response)
        except HTTPError as exc:
            raise SystemExit(f"{method} {path.split('?')[0]}: HTTP {exc.code}") from None
        except (URLError, ValueError, TimeoutError):
            raise SystemExit(f"{method} {path.split('?')[0]}: could not read gateway response") from None
        if not payload.get("success"):
            raise SystemExit(f"{method} {path.split('?')[0]}: {str(payload.get('message', 'failed')).replace(token, '[redacted]')}")
        return payload.get("data")

    root = Path(__file__).resolve().parent
    detail = api("POST", "/api/plugin/task", {
        "source": (root / "plugin.js").read_text(encoding="utf-8"), "enabled": True,
        "icon": "data:image/svg+xml;base64," + base64.b64encode((root / "icon.svg").read_bytes()).decode(),
    })
    meta = detail["meta"]
    key = meta["key"]
    assert key == "gorquan_grok_image"
    if not (detail["plugin"]["active"] and detail["plugin"]["enabled"]):
        api("POST", f"/api/plugin/task/{key}/activate", {"version": meta["version"]})
    endpoint = "/api/option/model_pricing"
    query = urlencode({"model": meta["models"]}, doseq=True)
    entries = api("GET", endpoint + "?" + query)["entries"]
    if {e["model_name"] for e in entries} != set(meta["models"]):
        raise SystemExit("Incomplete model pricing snapshot; no prices changed")
    option = "billing_setting.plugin_billing_expr"
    changes = []
    for entry in entries:
        pricing = dict(entry.get("configured") or {})
        variants = dict(pricing.get(option) or {})
        if key in variants or any(k in pricing for k in (
                "ModelPrice", "ModelRatio", "billing_setting.billing_mode", "billing_setting.billing_expr")):
            print("Keeping configured price:", entry["model_name"])
            continue
        variants[key] = 'tier("base", u("upstream_cost_usd") * 1)'
        pricing[option] = variants
        changes.append({"model_name": entry["model_name"], "expected_version": entry["version"], "pricing": pricing})
    if changes:
        api("PATCH", endpoint, {"changes": changes})
    print(f"Installed {key} {meta['version']}; added {len(changes)} provider price(s).")


if __name__ == "__main__":
    main()
