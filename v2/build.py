#!/usr/bin/env python3
"""Inject data.json into the dashboard template."""
from pathlib import Path

here = Path(__file__).parent
data = (here / "data.json").read_text()
tpl = (here / "template.html").read_text()
out = tpl.replace("/*__DATA__*/null", data)
(here / "dashboard.html").write_text(out)
print("wrote dashboard.html")
