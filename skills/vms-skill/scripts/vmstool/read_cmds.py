from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from .client import VmsError
from .session import Place, Session
from .transfer import download


def emit(args, data, lines):
	if args.json:
		print(json.dumps(data, indent=1, default=str))
	else:
		for line in lines:
			print(line)


def say(msg: str):
	print(msg, file=sys.stderr)


def size(n) -> str:
	n = float(n or 0)
	for unit in ("B", "KB", "MB", "GB"):
		if n < 1024:
			return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
		n /= 1024
	return f"{n:.1f} TB"


def duration(s) -> str:
	if not s:
		return ""
	s = int(s)
	return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def tags(asset) -> list[str]:
	return [t for t in (x.strip() for x in (asset.get("_user_tags") or "").split(",")) if t]


def asset_line(a, label=None) -> str:
	extra = "  ".join(
		x
		for x in (size(a.get("file_size")), duration(a.get("duration_seconds")), a.get("category") or "")
		if x
	)
	tag_list = tags(a)
	tag_txt = "  #" + " #".join(tag_list) if tag_list else ""
	return f"{label or a['file_name']}  {extra}{tag_txt}  ·{a['name']}"


def projects(s: Session, args):
	rows = s.projects()
	if args.query:
		rows = [p for p in rows if args.query.casefold() in p["project_name"].casefold()]
	emit(args, rows, [f"{p['project_name']}  [{p.get('status') or ''}]  ·{p['name']}" for p in rows])


def ls(s: Session, args):
	place = s.resolve(args.path)
	if place.asset:
		return show_asset(s, args, place.asset)
	tree = s.tree(place.project["name"])
	root = place.folder_name
	assets = s.assets_at(place, recursive=args.recursive)
	if args.recursive:
		rows = [
			{**a, "path": "/".join([*tree.relpath(a.get("folder"), root), a["file_name"]])} for a in assets
		]
		rows.sort(key=lambda a: a["path"].casefold())
		emit(args, rows, [asset_line(a, a["path"]) for a in rows] or ["(no files)"])
		return
	folders = tree.children[root]
	lines = [f"{f['folder_name']}/  ·{f['name']}" for f in folders] + [asset_line(a) for a in assets]
	emit(
		args,
		{"path": tree.path(root), "folders": folders, "assets": assets},
		[f"# {tree.path(root)}", *lines],
	)


def tree_cmd(s: Session, args):
	place = s.resolve(args.path, want="container")
	tree = s.tree(place.project["name"])
	counts = Counter(a.get("folder") or None for a in s.vms.assets([["project", "=", place.project["name"]]]))
	root = place.folder_name
	rows = [
		{"level": lvl, "name": f["name"], "folder_name": f["folder_name"], "files": counts.get(f["name"], 0)}
		for lvl, f in tree.walk(root, args.depth)
	]
	lines = [f"{tree.path(root)}/  ({counts.get(root, 0)} files)"]
	lines += [
		f"{'  ' * (r['level'] + 1)}{r['folder_name']}/  ({r['files']} files)  ·{r['name']}" for r in rows
	]
	emit(args, rows, lines)


def find(s: Session, args):
	filters = [["file_name", "like", f"%{args.text}%"]]
	if args.within:
		place = s.resolve(args.within, want="container")
		filters.append(["project", "=", place.project["name"]])
		if place.folder:
			filters.append(["folder", "in", s.tree(place.project["name"]).subtree(place.folder_name)])
	rows = [{**a, "path": s.asset_path(a)} for a in s.vms.assets(filters) if s.is_live(a)][: args.limit]
	emit(args, rows, [asset_line(a, a["path"]) for a in rows] or ["(no matches)"])


def info(s: Session, args):
	show_asset(s, args, s.resolve(args.path, want="asset").asset)


def show_asset(s: Session, args, a: dict):
	a = {**a, "path": s.asset_path(a), "tags": tags(a)}
	a.pop("_user_tags", None)
	lines = [f"{k}: {v}" for k, v in a.items() if v not in (None, "", [])]
	emit(args, a, lines)


def link(s: Session, args):
	rows = []
	for target in args.paths:
		place = s.resolve(target)
		for a in s.assets_at(place, recursive=args.recursive):
			url = s.vms.download_url(a["name"]) if args.download else s.vms.view_url(a["name"])
			rows.append({"name": a["name"], "path": s.asset_path(a), "url": url})
	emit(args, rows, [f"{r['path']}\t{r['url']}" for r in rows] or ["(no files)"])


def get(s: Session, args):
	out = Path(args.out).expanduser()
	plan = []
	for target in args.paths:
		place = s.resolve(target)
		for a in s.assets_at(place, recursive=args.recursive):
			plan.append((a, inside(out, local_path(s, place, a))))
	done = []
	for a, dest in plan:
		if dest.exists() and dest.stat().st_size == (a.get("file_size") or -1):
			say(f"skip {dest} (already here)")
		else:
			download(s.vms.download_url(a["name"]), dest, a["file_name"])
			say(f"got  {dest}")
		done.append({"name": a["name"], "file": str(dest)})
	if not plan:
		raise VmsError("no files there")
	if args.json:
		emit(args, done, [])


def inside(out: Path, parts: list[str]) -> Path:
	dest = out.joinpath(*(safe_segment(p) for p in parts))
	if not dest.resolve().is_relative_to(out.resolve()):
		raise VmsError(f"refusing to write outside {out}: {dest}")
	return dest


def safe_segment(seg: str) -> str:
	seg = (seg or "").replace("/", "_").replace("\\", "_").strip()
	if seg in ("", ".", ".."):
		raise VmsError(f"unsafe name from the server: {seg!r}")
	return seg


def local_path(s: Session, place: Place, asset: dict) -> list[str]:
	if place.asset:
		return [asset["file_name"]]
	tree = s.tree(place.project["name"])
	top = place.folder["folder_name"] if place.folder else place.project["project_name"]
	return [top, *tree.relpath(asset.get("folder"), place.folder_name), asset["file_name"]]


def transcript(s: Session, args):
	a = s.resolve(args.path, want="asset").asset
	t = s.vms.transcript(a["name"])
	if not t.get("transcription"):
		raise VmsError(
			f"no transcript for {a['file_name']} (status: {t.get('transcription_status') or 'none'})"
		)
	emit(args, t, [t["transcription"]])
