from __future__ import annotations

import mimetypes
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from .client import VmsError

CHUNK = 8 * 1024 * 1024
TIMEOUT = 120


def content_type(path: Path) -> str:
	return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def download(url: str, dest: Path, label: str):
	dest.parent.mkdir(parents=True, exist_ok=True)
	tmp = dest.with_name(dest.name + ".part")
	try:
		with (
			urllib.request.urlopen(url, timeout=TIMEOUT) as res,
			# nosemgrep: frappe-semgrep-rules.rules.security.frappe-security-file-traversal
			open(tmp, "wb") as out,
		):
			total = int(res.headers.get("Content-Length") or 0)
			meter = Meter(label, total)
			while chunk := res.read(CHUNK):
				out.write(chunk)
				meter.add(len(chunk))
		meter.done()
	except (urllib.error.URLError, OSError) as e:
		tmp.unlink(missing_ok=True)
		raise VmsError(f"download of {label} failed: {e}")
	os.replace(tmp, dest)


def put(url: str, path: Path, ctype: str, offset: int, length: int, meter: Meter) -> str:
	# nosemgrep: frappe-semgrep-rules.rules.security.frappe-security-file-traversal
	with open(path, "rb") as f:
		f.seek(offset)
		body = Slice(f, length, meter)
		req = urllib.request.Request(
			url, data=body, method="PUT", headers={"Content-Type": ctype, "Content-Length": str(length)}
		)
		try:
			with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
				return (res.headers.get("ETag") or "").strip('"')
		except urllib.error.HTTPError as e:
			raise VmsError(f"storage refused the upload ({e.code}): {e.read()[:300]!r}")
		except urllib.error.URLError as e:
			raise VmsError(f"upload failed: {e.reason}")


class Slice:
	def __init__(self, f, length: int, meter: Meter):
		self.f, self.left, self.meter = f, length, meter

	def read(self, size: int = -1) -> bytes:
		if self.left <= 0:
			return b""
		size = self.left if size < 0 else min(size, self.left)
		data = self.f.read(min(size, CHUNK))
		self.left -= len(data)
		self.meter.add(len(data))
		return data


class Meter:
	def __init__(self, label: str, total: int):
		self.label, self.total, self.seen, self.shown = label, total, 0, -1

	def add(self, n: int):
		self.seen += n
		if not self.total or not sys.stderr.isatty():
			return
		pct = self.seen * 100 // self.total
		if pct != self.shown:
			self.shown = pct
			print(f"\r  {self.label}  {pct}%", end="", file=sys.stderr, flush=True)

	def done(self):
		if self.total and sys.stderr.isatty():
			print(file=sys.stderr)
