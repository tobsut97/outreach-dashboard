#!/usr/bin/env python3
"""Inject data.json into the dashboard template."""
from pathlib import Path

data = Path("/Users/tobias/claude-workspace/outreach-dashboard/data.json").read_text()
tpl = Path("/Users/tobias/claude-workspace/outreach-dashboard/template.html").read_text()
out = tpl.replace("/*__DATA__*/null", data)
Path("/Users/tobias/claude-workspace/outreach-dashboard/dashboard.html").write_text(out)
print("wrote dashboard.html")
