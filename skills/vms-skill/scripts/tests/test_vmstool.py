import io
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import vmsctl
from vmstool import read_cmds, write_cmds
from vmstool.client import VmsError
from vmstool.session import Session


def matches(row, filters):
	for field, op, value in filters:
		got = row.get(field)
		if op == "=" and got != value:
			return False
		if op == "!=" and got == value:
			return False
		if op == "in" and got not in value:
			return False
		if op == "is" and bool(got) != (value == "set"):
			return False
		if op == "like" and value.strip("%").casefold() not in (got or "").casefold():
			return False
	return True


class FakeVms:
	def __init__(self):
		self.calls = []
		self.projects_ = [
			{"name": "VMS-PROJ-00001", "project_name": "Acme Launch", "status": "Open"},
			{"name": "VMS-PROJ-00002", "project_name": "Acme Labs", "status": "Open"},
			{"name": "VMS-PROJ-00003", "project_name": "Beta", "status": "Open"},
		]
		self.folders_ = [
			{
				"name": "VMS-FLD-00001",
				"folder_name": "Raw",
				"parent_folder": None,
				"project": "VMS-PROJ-00001",
			},
			{
				"name": "VMS-FLD-00002",
				"folder_name": "Day 1",
				"parent_folder": "VMS-FLD-00001",
				"project": "VMS-PROJ-00001",
			},
			{
				"name": "VMS-FLD-00003",
				"folder_name": "Edits",
				"parent_folder": None,
				"project": "VMS-PROJ-00001",
			},
		]
		self.assets_ = [
			self._asset("VMS-ASSET-00001", "intro.mp4", "VMS-PROJ-00001", None),
			self._asset("VMS-ASSET-00002", "a.mov", "VMS-PROJ-00001", "VMS-FLD-00002"),
			self._asset("VMS-ASSET-00003", "b.mov", "VMS-PROJ-00001", "VMS-FLD-00001"),
			self._asset("VMS-ASSET-00004", "cut.mp4", "VMS-PROJ-00001", "VMS-FLD-00003"),
		]

	def _asset(self, name, file_name, project, folder, size=10):
		return {
			"name": name,
			"file_name": file_name,
			"project": project,
			"folder": folder,
			"category": "Footage",
			"status": "Ready",
			"file_size": size,
			"_user_tags": "",
		}

	def projects(self):
		return self.projects_

	def folders(self, project):
		return [f for f in self.folders_ if f["project"] == project]

	def folder(self, name):
		return next(f for f in self.folders_ if f["name"] == name)

	def assets(self, filters, limit=None):
		rows = [a for a in self.assets_ if matches(a, [f for f in filters if f[0] != "deleted_at"])]
		return rows[:limit] if limit else rows

	def asset(self, name):
		rows = self.assets([["name", "=", name]])
		if not rows:
			raise VmsError(f"no asset {name}")
		return rows[0]

	def view_url(self, asset):
		return f"https://r2/view/{asset}"

	def download_url(self, asset):
		return f"https://r2/dl/{asset}"

	def create_folder(self, name, project, parent):
		folder = {
			"name": f"VMS-FLD-{len(self.folders_) + 1:05d}",
			"folder_name": name,
			"parent_folder": parent,
			"project": project,
		}
		self.folders_.append(folder)
		self.calls.append(("create_folder", name, parent))
		return folder

	def __getattr__(self, method):
		def record(*args):
			self.calls.append((method, *args))
			if method == "start_upload":
				return {
					"asset_name": "VMS-ASSET-09999",
					"r2_key": "k",
					"upload_url": "https://r2/put",
					"multipart": False,
				}
			if method == "share_folder":
				return {"share_url": "https://site/vms/shared/folder/x?token=t"}
			return {}

		return record


def run(vms, *argv):
	out, err = io.StringIO(), io.StringIO()
	args = vmsctl.parser().parse_args(argv)
	with redirect_stdout(out), redirect_stderr(err):
		args.run(Session(None, vms), args)
	return out.getvalue(), err.getvalue()


class Resolve(unittest.TestCase):
	def setUp(self):
		self.s = Session(None, FakeVms())

	def test_project_by_exact_name_beats_substring(self):
		self.assertEqual(self.s.project("Acme Launch")["name"], "VMS-PROJ-00001")
		self.assertEqual(self.s.project("beta")["name"], "VMS-PROJ-00003")

	def test_ambiguous_project_lists_choices(self):
		with self.assertRaisesRegex(VmsError, "several projects"):
			self.s.project("acme")

	def test_folder_path_case_insensitive(self):
		place = self.s.resolve("Acme Launch/raw/day 1")
		self.assertEqual(place.folder_name, "VMS-FLD-00002")

	def test_file_path(self):
		self.assertEqual(self.s.resolve("Acme Launch/Raw/Day 1/a.mov").asset["name"], "VMS-ASSET-00002")

	def test_missing_segment_lists_siblings(self):
		with self.assertRaisesRegex(VmsError, "Day 1/, b.mov"):
			self.s.resolve("Acme Launch/Raw/nope/x")

	def test_ids(self):
		self.assertEqual(self.s.resolve("VMS-FLD-00002").folder_name, "VMS-FLD-00002")
		self.assertEqual(self.s.place_path(self.s.resolve("VMS-ASSET-00002")), "Acme Launch/Raw/Day 1/a.mov")

	def test_container_refuses_file(self):
		with self.assertRaises(VmsError):
			self.s.resolve("VMS-ASSET-00001", want="container")


class Commands(unittest.TestCase):
	def test_ls_recursive_paths_are_relative(self):
		out, _ = run(FakeVms(), "ls", "Acme Launch/Raw", "-r")
		self.assertIn("Day 1/a.mov", out)
		self.assertIn("b.mov", out)
		self.assertNotIn("cut.mp4", out)

	def test_ls_project_root_recursive_includes_everything(self):
		out, _ = run(FakeVms(), "ls", "Acme Launch", "-r")
		for name in ("intro.mp4", "Raw/Day 1/a.mov", "Edits/cut.mp4"):
			self.assertIn(name, out)

	def test_link_folder(self):
		out, _ = run(FakeVms(), "link", "Acme Launch/Raw", "-r", "--download")
		self.assertIn("Acme Launch/Raw/Day 1/a.mov\thttps://r2/dl/VMS-ASSET-00002", out)

	def test_find_scoped(self):
		out, _ = run(FakeVms(), "find", "mov", "--in", "Acme Launch/Raw/Day 1")
		self.assertIn("a.mov", out)
		self.assertNotIn("b.mov", out)

	def test_get_keeps_structure_and_skips_existing(self):
		with tempfile.TemporaryDirectory() as d:
			(Path(d) / "Raw").mkdir()
			(Path(d) / "Raw" / "b.mov").write_bytes(b"x" * 10)
			with mock.patch.object(read_cmds, "download") as dl:
				_, err = run(FakeVms(), "get", "Acme Launch/Raw", "-r", "-o", d)
			dl.assert_called_once_with(
				"https://r2/dl/VMS-ASSET-00002", Path(d) / "Raw" / "Day 1" / "a.mov", "a.mov"
			)
			self.assertIn("skip", err)

	def test_get_stays_inside_out_dir(self):
		vms = FakeVms()
		vms.assets_[0]["file_name"] = "../../evil.mp4"
		vms.assets_[1]["file_name"] = ".."
		with tempfile.TemporaryDirectory() as d:
			with mock.patch.object(read_cmds, "download") as dl:
				run(vms, "get", "VMS-ASSET-00001", "-o", d)
				self.assertEqual(dl.call_args.args[1], Path(d) / ".._.._evil.mp4")
				with self.assertRaisesRegex(VmsError, "unsafe name"):
					run(vms, "get", "VMS-ASSET-00002", "-o", d)

	def test_mv_file_across_projects_then_into_folder(self):
		vms = FakeVms()
		vms.folders_.append(
			{"name": "VMS-FLD-00009", "folder_name": "In", "parent_folder": None, "project": "VMS-PROJ-00003"}
		)
		run(vms, "mv", "Acme Launch/intro.mp4", "Beta/In")
		self.assertEqual(
			vms.calls,
			[
				("move_asset_to_project", "VMS-ASSET-00001", "VMS-PROJ-00003"),
				("move_assets_to_folder", ["VMS-ASSET-00001"], "VMS-FLD-00009"),
			],
		)

	def test_mv_folder_to_project_root(self):
		vms = FakeVms()
		run(vms, "mv", "Acme Launch/Raw/Day 1", "Acme Launch")
		self.assertEqual(vms.calls, [("move_folder", "VMS-FLD-00002", None, "VMS-PROJ-00001")])

	def test_mkdir_parents(self):
		vms = FakeVms()
		run(vms, "mkdir", "-p", "Acme Launch/Raw/Day 2/Cam A")
		self.assertEqual([c[1] for c in vms.calls], ["Day 2", "Cam A"])

	def test_share_folder(self):
		out, _ = run(FakeVms(), "share", "Acme Launch/Edits")
		self.assertIn("vms/shared/folder", out)


class Upload(unittest.TestCase):
	def tree(self, d):
		root = Path(d) / "Shoot"
		(root / "Day 1").mkdir(parents=True)
		(root / "Day 1" / "new.mov").write_bytes(b"12345")
		(root / "a.mov").write_bytes(b"1")
		(root / ".DS_Store").write_bytes(b"")
		return root

	def test_dry_run_changes_nothing(self):
		vms = FakeVms()
		with tempfile.TemporaryDirectory() as d:
			_, err = run(vms, "upload", str(self.tree(d)), "--to", "Acme Launch/Raw", "-n")
		self.assertEqual(vms.calls, [])
		self.assertIn("would mkdir Acme Launch/Raw/Shoot\n", err)
		self.assertIn("would mkdir Acme Launch/Raw/Shoot/Day 1\n", err)
		self.assertNotIn(".DS_Store", err)

	def test_upload_folder_creates_structure_and_confirms(self):
		vms = FakeVms()
		with tempfile.TemporaryDirectory() as d, mock.patch.object(write_cmds, "put", return_value="etag"):
			run(vms, "upload", str(self.tree(d)), "--to", "Acme Launch/Raw")
		names = [c[0] for c in vms.calls]
		self.assertEqual(names.count("create_folder"), 2)
		self.assertEqual(names.count("start_upload"), 2)
		self.assertEqual(names.count("confirm_upload"), 2)

	def test_skips_name_clash_unless_forced(self):
		vms = FakeVms()
		with tempfile.TemporaryDirectory() as d:
			f = Path(d) / "b.mov"
			f.write_bytes(b"1")
			_, err = run(vms, "upload", str(f), "--to", "Acme Launch/Raw")
			self.assertIn("skip b.mov", err)
			with mock.patch.object(write_cmds, "put", return_value=""):
				run(vms, "upload", str(f), "--to", "Acme Launch/Raw", "--force")
		self.assertIn("confirm_upload", [c[0] for c in vms.calls])

	def test_failed_put_marks_upload_failed(self):
		vms = FakeVms()
		with tempfile.TemporaryDirectory() as d:
			f = Path(d) / "z.mov"
			f.write_bytes(b"1")
			with (
				mock.patch.object(write_cmds, "put", side_effect=VmsError("boom")),
				self.assertRaises(VmsError),
			):
				run(vms, "upload", str(f), "--to", "Acme Launch")
		self.assertEqual(vms.calls[-1], ("fail_upload", "VMS-ASSET-09999"))

	def test_multipart(self):
		vms = FakeVms()
		vms.start_upload = lambda *a: {
			"asset_name": "A",
			"r2_key": "k",
			"upload_id": "u",
			"multipart": True,
			"part_size": 2,
		}
		with tempfile.TemporaryDirectory() as d:
			f = Path(d) / "big.mov"
			f.write_bytes(b"12345")
			with mock.patch.object(write_cmds, "put", return_value="e") as put:
				write_cmds.upload_file(Session(None, vms), f, "P", None, "Footage")
		self.assertEqual([c.args[3:5] for c in put.call_args_list], [(0, 2), (2, 2), (4, 1)])
		self.assertIn(
			("complete_multipart", "A", "u", [{"PartNumber": i, "ETag": "e"} for i in (1, 2, 3)]), vms.calls
		)


if __name__ == "__main__":
	unittest.main()
