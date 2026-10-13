from __future__ import annotations

import json
import shutil
import subprocess
from typing import Any

API = "vms.api"
ASSET_FIELDS = [
	"name",
	"file_name",
	"project",
	"folder",
	"category",
	"status",
	"file_size",
	"file_type",
	"duration_seconds",
	"_user_tags",
	"version",
]
FOLDER_FIELDS = ["name", "folder_name", "parent_folder", "project"]
LIVE = [["deleted_at", "is", "not set"]]


class VmsError(RuntimeError):
	pass


class Vms:
	def __init__(self, site: str | None):
		self.ctl = Frappectl(site)

	def projects(self) -> list[dict]:
		return self.ctl.doc_list("VMS Project", ["name", "project_name", "status"], [], "project_name asc")

	def folders(self, project: str) -> list[dict]:
		return self.ctl.doc_list(
			"VMS Folder",
			FOLDER_FIELDS,
			[["project", "=", project], *LIVE],
			"folder_name asc",
		)

	def assets(self, filters: list, limit: int | None = None) -> list[dict]:
		base = [["status", "!=", "Uploading"], *LIVE]
		return self.ctl.doc_list("VMS Asset", ASSET_FIELDS, base + filters, "file_name asc", limit)

	def asset(self, name: str) -> dict:
		rows = self.assets([["name", "=", name]])
		if not rows:
			raise VmsError(f"no asset {name}")
		return rows[0]

	def folder(self, name: str) -> dict:
		rows = self.ctl.doc_list("VMS Folder", FOLDER_FIELDS, [["name", "=", name], *LIVE])
		if not rows:
			raise VmsError(f"no folder {name} (or it is in the trash)")
		return rows[0]

	def view_url(self, asset: str) -> str:
		return self.ctl.call(f"{API}.get_view_url", asset_name=asset)["url"]

	def download_url(self, asset: str) -> str:
		return self.ctl.call(f"{API}.get_download_url", asset_name=asset)["url"]

	def transcript(self, asset: str) -> dict:
		return self.ctl.get("vms.transcription.get_transcription", asset_name=asset)

	def create_folder(self, name: str, project: str, parent: str | None) -> dict:
		return self.ctl.call(f"{API}.create_folder", folder_name=name, project=project, parent_folder=parent)

	def rename_folder(self, folder: str, new_name: str):
		return self.ctl.call(f"{API}.rename_folder", folder_name_id=folder, new_name=new_name)

	def move_folder(self, folder: str, parent: str | None, project: str):
		return self.ctl.call(
			f"{API}.move_folder", folder_name_id=folder, parent_folder=parent, target_project=project
		)

	def rename_asset(self, asset: str, new_name: str):
		return self.ctl.call(f"{API}.rename_asset", asset_name=asset, new_file_name=new_name)

	def move_asset_to_project(self, asset: str, project: str):
		return self.ctl.call(f"{API}.move_asset", asset_name=asset, target_project=project)

	def move_assets_to_folder(self, assets: list[str], folder: str | None):
		return self.ctl.call(f"{API}.move_assets_to_folder", asset_names=assets, folder=folder)

	def add_tag(self, asset: str, tag: str) -> list[str]:
		return self.ctl.call(f"{API}.add_asset_tag", asset_name=asset, tag=tag)["tags"]

	def remove_tag(self, asset: str, tag: str) -> list[str]:
		return self.ctl.call(f"{API}.remove_asset_tag", asset_name=asset, tag=tag)["tags"]

	def set_category(self, asset: str, category: str):
		return self.ctl.call(f"{API}.update_asset_category", asset_name=asset, category=category)

	def share_project(self, project: str, on: bool) -> dict:
		action = "enable" if on else "disable"
		return self.ctl.call(f"{API}.{action}_project_sharing", project=project)

	def share_folder(self, folder: str, on: bool) -> dict:
		action = "enable" if on else "disable"
		return self.ctl.call(f"{API}.{action}_folder_sharing", folder=folder)

	def share_asset(self, asset: str, on: bool) -> dict:
		return self.ctl.call("vms.review_api.toggle_public_review", asset_name=asset, enable=int(on))

	def start_upload(
		self, file_name: str, content_type: str, size: int, project: str, folder: str | None, category: str
	) -> dict:
		return self.ctl.call(
			f"{API}.get_upload_url",
			file_name=file_name,
			content_type=content_type,
			file_size=size,
			project=project,
			folder=folder,
			category=category,
		)

	def part_url(self, r2_key: str, upload_id: str, part_number: int) -> str:
		return self.ctl.call(
			f"{API}.get_part_upload_url", r2_key=r2_key, upload_id=upload_id, part_number=part_number
		)["url"]

	def complete_multipart(self, asset: str, upload_id: str, parts: list[dict]):
		return self.ctl.call(f"{API}.complete_multipart", asset_name=asset, upload_id=upload_id, parts=parts)

	def abort_multipart(self, asset: str, upload_id: str):
		return self.ctl.call(f"{API}.abort_multipart", asset_name=asset, upload_id=upload_id)

	def fail_upload(self, asset: str):
		return self.ctl.call(f"{API}.fail_upload", asset_name=asset)

	def confirm_upload(self, asset: str, size: int) -> dict:
		return self.ctl.call(f"{API}.confirm_upload", asset_name=asset, file_size=size)


class Frappectl:
	def __init__(self, site: str | None):
		if not shutil.which("frappectl"):
			raise VmsError("frappectl is not installed (uv tool install frappectl)")
		self.prefix = ["frappectl", *(["-s", site] if site else [])]

	def call(self, method: str, **params) -> Any:
		body = json.dumps({k: v for k, v in params.items() if v is not None})
		return self._run(["api", f"method/{method}", "-X", "POST", "--input", "-"], body)

	def get(self, method: str, **params) -> Any:
		fields = [arg for k, v in params.items() if v is not None for arg in ("-f", f"{k}={v}")]
		return self._run(["api", f"method/{method}", "-X", "GET", *fields])

	def doc_list(
		self,
		doctype: str,
		fields: list[str],
		filters: list,
		order_by: str | None = None,
		limit: int | None = None,
	) -> list[dict]:
		args = ["doc", "list", doctype, "--fields", ",".join(fields), "--filters-json", json.dumps(filters)]
		if order_by:
			args += ["--order-by", order_by]
		args += ["--limit", str(limit)] if limit else ["--all"]
		return self._run([*args, "--json"]) or []

	def _run(self, args: list[str], stdin: str | None = None) -> Any:
		proc = subprocess.run(self.prefix + args, input=stdin, capture_output=True, text=True)
		if proc.returncode != 0:
			raise VmsError(error_text(proc.stderr) or "frappectl failed")
		out = proc.stdout.strip()
		return json.loads(out) if out else None


def error_text(stderr: str) -> str:
	lines = stderr.splitlines()
	start = next((i for i, ln in enumerate(lines) if ln.startswith("error:")), None)
	if start is None:
		return stderr.strip()
	body = [lines[start][len("error:") :].strip()]
	for ln in lines[start + 1 :]:
		if not ln.strip() or ln.startswith(("tip:", "error:")):
			break
		body.append(ln.strip())
	return " ".join(body)
