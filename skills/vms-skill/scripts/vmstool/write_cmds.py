from __future__ import annotations

from pathlib import Path

from .client import VmsError
from .read_cmds import emit, say
from .session import Place, Session, scope
from .transfer import Meter, content_type, put

MISSING = object()


def create_folder(s: Session, project: dict, parent: str | None, name: str) -> str:
	tree = s.tree(project["name"])
	say(f"mkdir {tree.path(parent)}/{name}")
	made = s.vms.create_folder(name, project["name"], parent)
	tree.add({**made, "folder_name": made.get("folder_name", name), "parent_folder": parent})
	return made["name"]


def target_folder(s: Session, dest: Place, dirs: tuple, known: dict, dry: bool = False):
	if dirs in known:
		return known[dirs]
	parent = target_folder(s, dest, dirs[:-1], known, dry)
	if parent is not MISSING and (hit := s.tree(dest.project["name"]).child(parent, dirs[-1])):
		known[dirs] = hit["name"]
	elif dry:
		known[dirs] = MISSING
		say(f"would mkdir {'/'.join([s.place_path(dest), *dirs])}")
	else:
		known[dirs] = create_folder(s, dest.project, parent, dirs[-1])
	return known[dirs]


def mkdir(s: Session, args):
	path = args.path.strip().strip("/")
	head, _, name = path.rpartition("/")
	if not head:
		raise VmsError("give a path inside a project, e.g. 'Acme Launch/Raw/Day 1'")
	if args.parents:
		first, *segs = path.split("/")
		base = Place(s.project(first))
		folder = target_folder(s, base, tuple(segs), {(): None})
	else:
		base = s.resolve(head, want="container")
		if s.tree(base.project["name"]).child(base.folder_name, name):
			raise VmsError(f"'{path}' already exists")
		folder = create_folder(s, base.project, base.folder_name, name)
	place = Place(base.project, s.tree(base.project["name"]).by_name[folder])
	emit(
		args,
		{"name": place.folder_name, "path": s.place_path(place)},
		[f"{s.place_path(place)}  ·{place.folder_name}"],
	)


def rename(s: Session, args):
	place = s.resolve(args.path)
	if place.asset:
		s.vms.rename_asset(place.asset["name"], args.new_name)
		name = place.asset["name"]
	elif place.folder:
		s.vms.rename_folder(place.folder_name, args.new_name)
		s.invalidate(place.project["name"])
		name = place.folder_name
	else:
		raise VmsError("renaming a project is not supported here. Use the VMS app.")
	emit(args, {"name": name, "new_name": args.new_name}, [f"renamed ·{name} to '{args.new_name}'"])


def move(s: Session, args):
	dest = s.resolve(args.dest, want="container")
	sources = [s.resolve(p) for p in args.paths]
	dest_path = s.place_path(dest)
	assets = [p.asset for p in sources if p.asset]
	folders = [p for p in sources if not p.asset]
	for f in folders:
		if not f.folder:
			raise VmsError(f"'{s.place_path(f)}' is a project. Only files and folders move.")
	for a in assets:
		if a.get("project") != dest.project["name"]:
			s.vms.move_asset_to_project(a["name"], dest.project["name"])
	if assets:
		s.vms.move_assets_to_folder([a["name"] for a in assets], dest.folder_name)
	lines = [f"moved {a['file_name']} → {dest_path}/" for a in assets]
	for f in folders:
		s.vms.move_folder(f.folder_name, dest.folder_name, dest.project["name"])
		lines.append(f"moved {f.folder['folder_name']}/ → {dest_path}/")
		s.invalidate(f.project["name"])
	s.invalidate(dest.project["name"])
	emit(
		args,
		{
			"dest": dest_path,
			"assets": [a["name"] for a in assets],
			"folders": [f.folder_name for f in folders],
		},
		lines,
	)


def tag(s: Session, args):
	a = s.resolve(args.path, want="asset").asset
	fn = s.vms.remove_tag if args.remove else s.vms.add_tag
	current = []
	for t in args.tags:
		current = fn(a["name"], t)
	emit(
		args,
		{"name": a["name"], "tags": current},
		[f"{a['file_name']}: {' '.join('#' + t for t in current) or '(no tags)'}"],
	)


def category(s: Session, args):
	rows = []
	for p in args.paths:
		a = s.resolve(p, want="asset").asset
		s.vms.set_category(a["name"], args.category)
		rows.append({"name": a["name"], "category": args.category})
	emit(args, rows, [f"·{r['name']} → {r['category']}" for r in rows])


def share(s: Session, args):
	place = s.resolve(args.path)
	on = not args.off
	if place.asset:
		url = s.vms.share_asset(place.asset["name"], on).get("share_url")
	elif place.folder:
		url = s.vms.share_folder(place.folder_name, on).get("share_url")
	else:
		url = s.vms.share_project(place.project["name"], on).get("share_url")
	what = s.place_path(place)
	emit(
		args,
		{"path": what, "url": url},
		[url] if on else [f"sharing off for {what}. Old links stop working."],
	)


def upload(s: Session, args):
	dest = s.resolve(args.to, want="container")
	plan = []
	for raw in args.paths:
		src = Path(raw).expanduser()
		if src.is_dir():
			plan += [
				(f, [src.name, *f.relative_to(src).parent.parts])
				for f in sorted(src.rglob("*"))
				if _wanted(f, src)
			]
		elif src.is_file():
			plan.append((src, []))
		else:
			raise VmsError(f"no such file or folder: {raw}")
	if not plan:
		raise VmsError("nothing to upload")

	done, failed, folders, present = [], [], {(): dest.folder_name}, {}
	for path, dirs in plan:
		folder = target_folder(s, dest, tuple(dirs), folders, args.dry_run)
		where = "/".join([s.place_path(dest), *dirs])
		if folder is not MISSING and not args.force:
			if folder not in present:
				rows = s.vms.assets(scope(dest.project["name"], [folder]))
				present[folder] = {a["file_name"]: a["name"] for a in rows}
			if path.name in present[folder]:
				say(
					f"skip {path.name} (already in {where} as ·{present[folder][path.name]}; --force uploads a copy)"
				)
				continue
		if args.dry_run:
			say(f"would upload {path} → {where}/")
			continue
		try:
			asset = upload_file(s, path, dest.project["name"], folder, args.category)
		except VmsError as e:
			say(f"FAIL {path}: {e}")
			failed.append(str(path))
			continue
		say(f"up   {path} → {where}/  ·{asset}")
		present.get(folder, {})[path.name] = asset
		done.append({"name": asset, "file": str(path), "path": f"{where}/{path.name}"})
	if args.json:
		emit(args, done, [])
	if failed:
		raise VmsError(
			f"{len(failed)} of {len(plan)} files failed. Fix the cause and run the same command again."
		)


def _wanted(f: Path, root: Path) -> bool:
	return f.is_file() and not any(part.startswith(".") for part in f.relative_to(root).parts)


def upload_file(s: Session, path: Path, project: str, folder: str | None, category: str) -> str:
	total = path.stat().st_size
	ctype = content_type(path)
	start = s.vms.start_upload(path.name, ctype, total, project, folder, category)
	asset = start["asset_name"]
	meter = Meter(path.name, total)
	multipart = bool(start.get("multipart"))
	try:
		if multipart:
			parts, part_size = [], int(start["part_size"])
			for i, offset in enumerate(range(0, total, part_size), start=1):
				url = s.vms.part_url(start["r2_key"], start["upload_id"], i)
				etag = put(url, path, ctype, offset, min(part_size, total - offset), meter)
				parts.append({"PartNumber": i, "ETag": etag})
			s.vms.complete_multipart(asset, start["upload_id"], parts)
		else:
			put(start["upload_url"], path, ctype, 0, total, meter)
	except BaseException:
		if multipart:
			s.vms.abort_multipart(asset, start["upload_id"])
		else:
			s.vms.fail_upload(asset)
		raise
	finally:
		meter.done()
	s.vms.confirm_upload(asset, total)
	return asset
