# Copyright (c) 2026, BWH and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase


def _make_project(name="Shared Browsing Test Project"):
	existing = frappe.db.get_value("VMS Project", {"project_name": name}, "name")
	if existing:
		return existing
	doc = frappe.get_doc({"doctype": "VMS Project", "project_name": name, "owner_user": "Administrator"})
	doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.name


def _make_folder(project, folder_name, parent_folder=None):
	doc = frappe.get_doc(
		{
			"doctype": "VMS Folder",
			"folder_name": folder_name,
			"project": project,
			"parent_folder": parent_folder,
		}
	)
	doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.name


class TestFolderBreadcrumb(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.project = _make_project()
		cls.root = _make_folder(cls.project, "Breadcrumb Root")
		cls.child = _make_folder(cls.project, "Breadcrumb Child", parent_folder=cls.root)
		cls.grandchild = _make_folder(cls.project, "Breadcrumb Grandchild", parent_folder=cls.child)
		cls.sibling = _make_folder(cls.project, "Breadcrumb Sibling")

	def test_root_itself_returns_single_item_trail(self):
		from vms.api import _folder_breadcrumb

		trail = _folder_breadcrumb(self.root, self.root)
		self.assertEqual(trail, [{"name": self.root, "folder_name": "Breadcrumb Root"}])

	def test_grandchild_returns_full_trail_in_order(self):
		from vms.api import _folder_breadcrumb

		trail = _folder_breadcrumb(self.grandchild, self.root)
		self.assertEqual([t["name"] for t in trail], [self.root, self.child, self.grandchild])

	def test_sibling_outside_root_is_rejected(self):
		from vms.api import _folder_breadcrumb

		self.assertIsNone(_folder_breadcrumb(self.sibling, self.root))

	def test_trashed_current_is_rejected(self):
		from vms.api import _folder_breadcrumb

		frappe.db.set_value("VMS Folder", self.grandchild, "deleted_at", frappe.utils.now())
		frappe.db.commit()
		try:
			self.assertIsNone(_folder_breadcrumb(self.grandchild, self.root))
		finally:
			frappe.db.set_value("VMS Folder", self.grandchild, "deleted_at", None)
			frappe.db.commit()

	def test_live_folder_under_trashed_ancestor_is_rejected(self):
		from vms.api import _folder_breadcrumb

		frappe.db.set_value("VMS Folder", self.child, "deleted_at", frappe.utils.now())
		frappe.db.commit()
		try:
			self.assertIsNone(_folder_breadcrumb(self.grandchild, self.root))
		finally:
			frappe.db.set_value("VMS Folder", self.child, "deleted_at", None)
			frappe.db.commit()


class TestProjectFolderBreadcrumb(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.project = _make_project()
		cls.other_project = _make_project("Shared Browsing Other Project")
		cls.top = _make_folder(cls.project, "PB Top")
		cls.nested = _make_folder(cls.project, "PB Nested", parent_folder=cls.top)
		cls.foreign = _make_folder(cls.other_project, "PB Foreign")

	def test_no_current_means_root_loose_files(self):
		from vms.api import _project_folder_breadcrumb

		self.assertEqual(_project_folder_breadcrumb(None, self.project), [])

	def test_nested_folder_returns_full_trail(self):
		from vms.api import _project_folder_breadcrumb

		trail = _project_folder_breadcrumb(self.nested, self.project)
		self.assertEqual([t["name"] for t in trail], [self.top, self.nested])

	def test_folder_from_another_project_is_rejected(self):
		from vms.api import _project_folder_breadcrumb

		self.assertIsNone(_project_folder_breadcrumb(self.foreign, self.project))

	def test_live_folder_under_trashed_ancestor_is_rejected(self):
		from vms.api import _project_folder_breadcrumb

		frappe.db.set_value("VMS Folder", self.top, "deleted_at", frappe.utils.now())
		frappe.db.commit()
		try:
			self.assertIsNone(_project_folder_breadcrumb(self.nested, self.project))
		finally:
			frappe.db.set_value("VMS Folder", self.top, "deleted_at", None)
			frappe.db.commit()


class TestFolderIsLive(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.project = _make_project()
		cls.folder = _make_folder(cls.project, "Liveness Folder")

	def test_live_folder_is_true(self):
		from vms.api import _folder_is_live

		self.assertTrue(_folder_is_live(self.folder))

	def test_trashed_folder_is_false(self):
		from vms.api import _folder_is_live

		frappe.db.set_value("VMS Folder", self.folder, "deleted_at", frappe.utils.now())
		frappe.db.commit()
		try:
			self.assertFalse(_folder_is_live(self.folder))
		finally:
			frappe.db.set_value("VMS Folder", self.folder, "deleted_at", None)
			frappe.db.commit()

	def test_nonexistent_folder_is_false(self):
		from vms.api import _folder_is_live

		self.assertFalse(_folder_is_live("VMS-FLD-DOES-NOT-EXIST"))


def _make_asset(project, folder=None, file_name="test.jpg", status="Ready"):
	doc = frappe.get_doc(
		{
			"doctype": "VMS Asset",
			"file_name": file_name,
			"r2_key": f"test/{frappe.generate_hash(length=8)}.jpg",
			"file_type": "image/jpeg",
			"status": status,
			"category": "Footage",
			"uploaded_by": "Administrator",
			"project": project,
			"folder": folder,
		}
	)
	doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.name


class TestAssetInSharedScope(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.project = _make_project()
		cls.root = _make_folder(cls.project, "Scope Root")
		cls.child = _make_folder(cls.project, "Scope Child", parent_folder=cls.root)
		cls.sibling = _make_folder(cls.project, "Scope Sibling")
		cls.deep_asset = _make_asset(cls.project, folder=cls.child, file_name="deep.jpg")
		cls.sibling_asset = _make_asset(cls.project, folder=cls.sibling, file_name="sibling.jpg")
		cls.loose_asset = _make_asset(cls.project, folder=None, file_name="loose.jpg")

	def _asset_dict(self, name):
		return frappe.db.get_value("VMS Asset", name, ["project", "folder"], as_dict=True)

	def test_asset_two_levels_deep_is_in_folder_share_scope(self):
		from vms.api import _asset_in_shared_scope

		asset = self._asset_dict(self.deep_asset)
		self.assertTrue(_asset_in_shared_scope(asset, folder=self.root))

	def test_sibling_asset_is_not_in_folder_share_scope(self):
		from vms.api import _asset_in_shared_scope

		asset = self._asset_dict(self.sibling_asset)
		self.assertFalse(_asset_in_shared_scope(asset, folder=self.root))

	def test_loose_asset_is_not_in_folder_share_scope(self):
		from vms.api import _asset_in_shared_scope

		asset = self._asset_dict(self.loose_asset)
		self.assertFalse(_asset_in_shared_scope(asset, folder=self.root))

	def test_any_folder_depth_is_in_project_share_scope(self):
		from vms.api import _asset_in_shared_scope

		asset = self._asset_dict(self.deep_asset)
		self.assertTrue(_asset_in_shared_scope(asset, project=self.project))

	def test_loose_asset_is_in_project_share_scope(self):
		from vms.api import _asset_in_shared_scope

		asset = self._asset_dict(self.loose_asset)
		self.assertTrue(_asset_in_shared_scope(asset, project=self.project))

	def test_asset_in_trashed_folder_is_not_in_project_share_scope(self):
		from vms.api import _asset_in_shared_scope

		frappe.db.set_value("VMS Folder", self.sibling, "deleted_at", frappe.utils.now())
		frappe.db.commit()
		try:
			asset = self._asset_dict(self.sibling_asset)
			self.assertFalse(_asset_in_shared_scope(asset, project=self.project))
		finally:
			frappe.db.set_value("VMS Folder", self.sibling, "deleted_at", None)
			frappe.db.commit()


class TestGetSharedFolder(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.project = _make_project()
		cls.root = _make_folder(cls.project, "GSF Root")
		cls.child_a = _make_folder(cls.project, "GSF Child A", parent_folder=cls.root)
		cls.child_b = _make_folder(cls.project, "GSF Child B", parent_folder=cls.root)
		cls.grandchild = _make_folder(cls.project, "GSF Grandchild", parent_folder=cls.child_a)
		cls.root_asset = _make_asset(cls.project, folder=cls.root, file_name="root.jpg")
		cls.a_asset = _make_asset(cls.project, folder=cls.child_a, file_name="a.jpg")
		cls.b_asset = _make_asset(cls.project, folder=cls.child_b, file_name="b.jpg")

		from vms.api import enable_folder_sharing

		cls.token = enable_folder_sharing(cls.root)["share_token"]

	def test_root_view_lists_direct_asset_and_subfolder_tiles(self):
		from vms.api import get_shared_folder, get_shared_folder_assets

		info = get_shared_folder(self.root, self.token)
		self.assertEqual(info["breadcrumb"], [{"name": self.root, "folder_name": "GSF Root"}])
		self.assertEqual(sorted(f["name"] for f in info["subfolders"]), sorted([self.child_a, self.child_b]))

		assets = get_shared_folder_assets(self.root, self.token)
		self.assertEqual([a["name"] for a in assets["assets"]], [self.root_asset])

	def test_browsing_into_a_child_scopes_to_that_child(self):
		from vms.api import get_shared_folder, get_shared_folder_assets

		info = get_shared_folder(self.root, self.token, current=self.child_a)
		self.assertEqual([t["name"] for t in info["breadcrumb"]], [self.root, self.child_a])
		self.assertEqual([f["name"] for f in info["subfolders"]], [self.grandchild])

		assets = get_shared_folder_assets(self.root, self.token, current=self.child_a)
		self.assertEqual([a["name"] for a in assets["assets"]], [self.a_asset])

	def test_current_outside_the_shared_subtree_is_rejected(self):
		from vms.api import get_shared_folder

		other_root = _make_folder(self.project, "GSF Unrelated")
		with self.assertRaises(frappe.exceptions.AuthenticationError):
			get_shared_folder(self.root, self.token, current=other_root)

	def test_recursive_assets_include_the_whole_subtree(self):
		from vms.api import get_shared_folder_assets

		assets = get_shared_folder_assets(self.root, self.token, recursive=1, page_size=100)
		self.assertEqual(
			sorted(a["name"] for a in assets["assets"]),
			sorted([self.root_asset, self.a_asset, self.b_asset]),
		)


class TestGetSharedProject(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.project = _make_project("GSP Project")
		cls.top_a = _make_folder(cls.project, "GSP Top A")
		cls.top_b = _make_folder(cls.project, "GSP Top B")
		cls.nested = _make_folder(cls.project, "GSP Nested", parent_folder=cls.top_a)
		cls.loose_asset = _make_asset(cls.project, folder=None, file_name="loose.jpg")
		cls.a_asset = _make_asset(cls.project, folder=cls.top_a, file_name="a.jpg")
		cls.nested_asset = _make_asset(cls.project, folder=cls.nested, file_name="nested.jpg")
		cls.b_asset = _make_asset(cls.project, folder=cls.top_b, file_name="b.jpg")

		from vms.api import enable_project_sharing

		cls.token = enable_project_sharing(cls.project)["share_token"]

	def test_root_view_lists_loose_asset_and_top_level_folders(self):
		from vms.api import get_shared_project, get_shared_project_assets

		info = get_shared_project(self.project, self.token)
		self.assertEqual(info["breadcrumb"], [])
		self.assertEqual(sorted(f["name"] for f in info["subfolders"]), sorted([self.top_a, self.top_b]))

		assets = get_shared_project_assets(self.project, self.token)
		self.assertEqual([a["name"] for a in assets["assets"]], [self.loose_asset])

	def test_browsing_into_a_top_level_folder_scopes_to_it(self):
		from vms.api import get_shared_project, get_shared_project_assets

		info = get_shared_project(self.project, self.token, current=self.top_a)
		self.assertEqual([t["name"] for t in info["breadcrumb"]], [self.top_a])
		self.assertEqual([f["name"] for f in info["subfolders"]], [self.nested])

		assets = get_shared_project_assets(self.project, self.token, current=self.top_a)
		self.assertEqual([a["name"] for a in assets["assets"]], [self.a_asset])

	def test_current_from_another_project_is_rejected(self):
		from vms.api import get_shared_project

		other_project = _make_project("GSP Other Project")
		foreign_folder = _make_folder(other_project, "GSP Foreign")
		with self.assertRaises(frappe.exceptions.AuthenticationError):
			get_shared_project(self.project, self.token, current=foreign_folder)

	def test_recursive_assets_include_the_whole_project(self):
		from vms.api import get_shared_project_assets

		assets = get_shared_project_assets(self.project, self.token, recursive=1, page_size=100)
		self.assertEqual(
			sorted(a["name"] for a in assets["assets"]),
			sorted([self.loose_asset, self.a_asset, self.nested_asset, self.b_asset]),
		)
		self.assertEqual(assets["total"], 4)
