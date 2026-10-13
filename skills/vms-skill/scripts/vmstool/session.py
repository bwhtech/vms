from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass

from .client import Vms, VmsError

ID = re.compile(r"^VMS-(PROJ|FLD|ASSET)-\d+$")
INBOX = "(inbox)"


@dataclass
class Place:
	project: dict
	folder: dict | None = None
	asset: dict | None = None

	@property
	def folder_name(self) -> str | None:
		return self.folder["name"] if self.folder else None


class Tree:
	def __init__(self, project: dict, folders: list[dict]):
		self.project = project
		self.by_name = {f["name"]: f for f in folders}
		self.children: dict[str | None, list[dict]] = defaultdict(list)
		for f in folders:
			self.children[f.get("parent_folder") or None].append(f)

	def child(self, parent: str | None, title: str) -> dict | None:
		kids = self.children[parent]
		exact = [f for f in kids if f["folder_name"] == title]
		loose = exact or [f for f in kids if f["folder_name"].casefold() == title.casefold()]
		if len(loose) > 1:
			ids = ", ".join(f["name"] for f in loose)
			raise VmsError(f"several folders named '{title}' here: {ids}. Use an ID.")
		return loose[0] if loose else None

	def add(self, folder: dict):
		self.by_name[folder["name"]] = folder
		self.children[folder.get("parent_folder") or None].append(folder)

	def relpath(self, folder: str | None, root: str | None) -> list[str]:
		return self.segments(folder)[len(self.segments(root)) :]

	def segments(self, folder: str | None) -> list[str]:
		out = []
		while folder and folder in self.by_name:
			out.append(self.by_name[folder]["folder_name"])
			folder = self.by_name[folder].get("parent_folder")
		return out[::-1]

	def path(self, folder: str | None) -> str:
		return "/".join([self.project["project_name"], *self.segments(folder)])

	def subtree(self, folder: str | None) -> list[str]:
		out, frontier = [], [folder]
		while frontier:
			nxt = [c["name"] for f in frontier for c in self.children[f]]
			out += nxt
			frontier = nxt
		return ([folder] if folder else []) + out

	def walk(self, folder: str | None, depth: int | None, level: int = 0):
		if depth is not None and level >= depth:
			return
		for f in self.children[folder]:
			yield level, f
			yield from self.walk(f["name"], depth, level + 1)


class Session:
	def __init__(self, site: str | None, vms: Vms | None = None):
		self.vms = vms or Vms(site)
		self._projects: list[dict] | None = None
		self._trees: dict[str, Tree] = {}

	def projects(self) -> list[dict]:
		if self._projects is None:
			self._projects = self.vms.projects()
		return self._projects

	def project(self, phrase: str) -> dict:
		ps = self.projects()
		key = phrase.casefold()
		tests = (
			lambda p: p["name"] == phrase,
			lambda p: p["project_name"] == phrase,
			lambda p: p["project_name"].casefold() == key,
			lambda p: key in p["project_name"].casefold(),
		)
		for test in tests:
			hits = [p for p in ps if test(p)]
			if len(hits) == 1:
				return hits[0]
			if hits:
				raise VmsError(f"'{phrase}' matches several projects. Pick one:{listing(hits)}")
		raise VmsError(f"no project matches '{phrase}'. Projects:{listing(ps[:30])}")

	def project_by_id(self, name: str) -> dict:
		for p in self.projects():
			if p["name"] == name:
				return p
		raise VmsError(f"no project {name}")

	def tree(self, project: str) -> Tree:
		if project not in self._trees:
			self._trees[project] = Tree(self.project_by_id(project), self.vms.folders(project))
		return self._trees[project]

	def is_live(self, asset: dict) -> bool:
		folder = asset.get("folder")
		return not asset.get("project") or not folder or folder in self.tree(asset["project"]).by_name

	def invalidate(self, project: str):
		self._trees.pop(project, None)

	def resolve(self, path: str, want: str = "any") -> Place:
		path = path.strip().strip("/")
		if not path:
			raise VmsError("empty path. Start with a project name, e.g. 'Acme Launch/Raw'")
		if ID.match(path):
			return self._resolve_id(path, want)

		first, *rest = path.split("/")
		project = self.project(first)
		tree = self.tree(project["name"])
		folder = None
		for i, seg in enumerate(rest):
			hit = tree.child(folder, seg)
			if hit:
				folder = hit["name"]
				continue
			if i == len(rest) - 1 and want != "container":
				return Place(project, tree.by_name.get(folder), self._asset_named(project, folder, seg))
			raise VmsError(self._missing(tree, folder, seg, want))
		place = Place(project, tree.by_name.get(folder))
		if want == "asset":
			raise VmsError(f"'{path}' is a folder, not a file")
		return place

	def _resolve_id(self, name: str, want: str) -> Place:
		kind = ID.match(name).group(1)
		if kind == "ASSET":
			if want == "container":
				raise VmsError(f"{name} is a file, not a folder or project")
			asset = self.vms.asset(name)
			if not asset.get("project"):
				return Place({"name": None, "project_name": INBOX}, None, asset)
			tree = self.tree(asset["project"])
			return Place(tree.project, tree.by_name.get(asset.get("folder")), asset)
		if want == "asset":
			raise VmsError(f"{name} is not a file")
		if kind == "PROJ":
			return Place(self.project_by_id(name))
		folder = self.vms.folder(name)
		tree = self.tree(folder["project"])
		return Place(tree.project, tree.by_name[name])

	def _asset_named(self, project: dict, folder: str | None, file_name: str) -> dict:
		rows = self.vms.assets([*scope(project["name"], [folder]), ["file_name", "=", file_name]])
		if len(rows) == 1:
			return rows[0]
		if rows:
			ids = ", ".join(a["name"] for a in rows)
			raise VmsError(f"several files named '{file_name}' here: {ids}. Use an ID.")
		raise VmsError(self._missing(self.tree(project["name"]), folder, file_name, "any"))

	def _missing(self, tree: Tree, folder: str | None, seg: str, want: str) -> str:
		where = tree.path(folder)
		kids = [f["folder_name"] + "/" for f in tree.children[folder]]
		if want != "container":
			kids += [a["file_name"] for a in self.vms.assets(scope(tree.project["name"], [folder]), limit=50)]
		listing = ", ".join(kids[:40]) or "(empty)"
		return f"nothing named '{seg}' in '{where}'. It has: {listing}"

	def assets_at(self, place: Place, recursive: bool = False) -> list[dict]:
		if place.asset:
			return [place.asset]
		tree = self.tree(place.project["name"])
		if recursive and place.folder is None:
			return [a for a in self.vms.assets([["project", "=", place.project["name"]]]) if self.is_live(a)]
		folders = tree.subtree(place.folder_name) if recursive else [place.folder_name]
		return self.vms.assets(scope(place.project["name"], folders))

	def asset_path(self, asset: dict) -> str:
		if not asset.get("project"):
			return f"{INBOX}/{asset['file_name']}"
		return f"{self.tree(asset['project']).path(asset.get('folder'))}/{asset['file_name']}"

	def place_path(self, place: Place) -> str:
		if place.asset:
			return self.asset_path(place.asset)
		return self.tree(place.project["name"]).path(place.folder_name)


def listing(projects: list[dict]) -> str:
	return "".join(f"\n  {p['name']}  {p['project_name']}" for p in projects)


def scope(project: str, folders: list[str | None]) -> list:
	if folders == [None]:
		return [["project", "=", project], ["folder", "is", "not set"]]
	return [["project", "=", project], ["folder", "in", folders]]
