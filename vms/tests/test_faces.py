# Copyright (c) 2026, BWH and Contributors
# See license.txt

from unittest.mock import patch

import frappe
import numpy as np
from frappe.tests import IntegrationTestCase

from vms.api import get_project_assets
from vms.deletion import hard_delete_asset, soft_delete_asset
from vms.faces import _pending_photo_names, get_project_people, index_asset_faces, rename_person

RNG = np.random.default_rng(145)


def _identity():
	vector = RNG.normal(size=128)
	return vector / np.linalg.norm(vector)


def _photo_of(identity, noise=0.15):
	vector = identity + RNG.normal(size=128) * noise / np.sqrt(128)
	return vector / np.linalg.norm(vector)


def _face(embedding, box=(0.1, 0.1, 0.2, 0.2)):
	return {"box": list(box), "score": 0.95, "embedding": embedding}


class TestFaceClustering(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.project = (
			frappe.get_doc(
				{
					"doctype": "VMS Project",
					"project_name": f"Faces {frappe.generate_hash(length=6)}",
					"owner_user": "Administrator",
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	@classmethod
	def tearDownClass(cls):
		frappe.delete_doc("VMS Project", cls.project, ignore_permissions=True, force=True)
		frappe.db.commit()
		super().tearDownClass()

	def setUp(self):
		self.was_enabled = frappe.db.get_single_value("VMS Settings", "face_recognition_enabled")
		frappe.db.set_single_value("VMS Settings", "face_recognition_enabled", 1)
		self.assets = []

	def tearDown(self):
		for asset in self.assets:
			if frappe.db.exists("VMS Asset", asset):
				soft_delete_asset(asset)
				hard_delete_asset(asset)
		frappe.db.set_single_value("VMS Settings", "face_recognition_enabled", self.was_enabled)
		frappe.db.commit()

	def _photo(self, *faces):
		asset = frappe.get_doc(
			{
				"doctype": "VMS Asset",
				"file_name": "photo.jpg",
				"r2_key": f"test/{frappe.generate_hash(length=10)}.jpg",
				"file_type": "image/jpeg",
				"status": "Ready",
				"category": "Footage",
				"project": self.project,
			}
		).insert(ignore_permissions=True)
		frappe.db.commit()
		self.assets.append(asset.name)
		self._index(asset.name, list(faces))
		return asset.name

	def _index(self, asset, faces):
		with (
			patch("vms.faces._load_models"),
			patch("vms.faces._download_file"),
			patch("vms.faces.generate_presigned_view_url"),
			patch("vms.faces._open_photo"),
			patch("vms.faces.detect_faces", return_value=faces),
		):
			index_asset_faces(asset)

	def _people_of(self, asset):
		return frappe.get_all("VMS Face", filters={"asset": asset}, pluck="person")

	def test_same_face_in_two_photos_is_one_person(self):
		alice = _identity()
		first = self._photo(_face(_photo_of(alice)))
		second = self._photo(_face(_photo_of(alice)))

		self.assertEqual(self._people_of(first), self._people_of(second))
		self.assertEqual(frappe.db.get_value("VMS Person", self._people_of(first)[0], "face_count"), 2)

	def test_different_faces_are_different_people(self):
		first = self._photo(_face(_photo_of(_identity())))
		second = self._photo(_face(_photo_of(_identity())))

		self.assertNotEqual(self._people_of(first), self._people_of(second))

	def test_two_faces_in_one_photo_never_share_a_person(self):
		twin = _identity()
		photo = self._photo(_face(_photo_of(twin)), _face(_photo_of(twin)))

		self.assertEqual(len(set(self._people_of(photo))), 2)

	def test_reindexing_replaces_faces_instead_of_adding(self):
		alice = _identity()
		photo = self._photo(_face(_photo_of(alice)))
		person = self._people_of(photo)[0]

		self._index(photo, [_face(_photo_of(alice))])

		self.assertEqual(len(self._people_of(photo)), 1)
		self.assertEqual(frappe.db.get_value("VMS Person", person, "face_count"), 1)

	def test_unchanged_file_is_marked_indexed(self):
		photo = self._photo()

		self.assertEqual(
			frappe.db.get_value("VMS Asset", photo, "face_index_key"),
			frappe.db.get_value("VMS Asset", photo, "r2_key"),
		)

	def test_deleting_last_photo_removes_the_person(self):
		photo = self._photo(_face(_photo_of(_identity())))
		person = self._people_of(photo)[0]

		soft_delete_asset(photo)
		hard_delete_asset(photo)

		self.assertFalse(frappe.db.exists("VMS Face", {"asset": photo}))
		self.assertFalse(frappe.db.exists("VMS Person", person))

	def test_deleting_cover_photo_moves_cover_to_remaining_face(self):
		alice = _identity()
		big = self._photo(_face(_photo_of(alice), box=(0, 0, 0.5, 0.5)))
		small = self._photo(_face(_photo_of(alice)))
		person = self._people_of(big)[0]
		self.assertEqual(
			frappe.db.get_value("VMS Face", frappe.db.get_value("VMS Person", person, "cover_face"), "asset"),
			big,
		)

		soft_delete_asset(big)
		hard_delete_asset(big)

		cover = frappe.db.get_value("VMS Person", person, "cover_face")
		self.assertEqual(frappe.db.get_value("VMS Face", cover, "asset"), small)

	def test_naming_a_person_with_an_existing_name_merges_them(self):
		first = self._photo(_face(_photo_of(_identity())))
		second = self._photo(_face(_photo_of(_identity())))
		name = f"Alice {frappe.generate_hash(length=6)}"
		rename_person(self._people_of(first)[0], name)
		duplicate = self._people_of(second)[0]

		result = rename_person(duplicate, name)

		self.assertTrue(result["merged"])
		self.assertFalse(frappe.db.exists("VMS Person", duplicate))
		self.assertEqual(self._people_of(second), self._people_of(first))
		self.assertEqual(frappe.db.get_value("VMS Person", result["person"], "face_count"), 2)

	def test_person_filter_and_people_list(self):
		alice, bob = _identity(), _identity()
		together = self._photo(_face(_photo_of(alice)), _face(_photo_of(bob)))
		alone = self._photo(_face(_photo_of(alice)))
		trashed = self._photo(_face(_photo_of(alice)))
		soft_delete_asset(trashed)
		alice_person = self._people_of(alone)[0]

		result = get_project_assets(self.project, person=alice_person, page_size=50)
		counts = {row.name: row.count for row in get_project_people(self.project)["people"]}

		self.assertEqual({asset.name for asset in result["assets"]}, {together, alone})
		self.assertEqual(counts[alice_person], 2)
		self.assertEqual(len(counts), 2)

	def test_plain_delete_of_an_asset_with_faces_cleans_up(self):
		photo = self._photo(_face(_photo_of(_identity())))
		person = self._people_of(photo)[0]

		frappe.delete_doc("VMS Asset", photo, ignore_permissions=True)

		self.assertFalse(frappe.db.exists("VMS Face", {"asset": photo}))
		self.assertFalse(frappe.db.exists("VMS Person", person))

	def test_nothing_is_indexed_while_disabled(self):
		frappe.db.set_single_value("VMS Settings", "face_recognition_enabled", 0)

		photo = self._photo(_face(_photo_of(_identity())))

		self.assertFalse(frappe.db.exists("VMS Face", {"asset": photo}))
		self.assertFalse(frappe.db.get_value("VMS Asset", photo, "face_index_key"))

	def test_failed_photo_is_not_retried_until_its_file_changes(self):
		photo = self._photo()
		frappe.db.set_value("VMS Asset", photo, "face_index_key", None)

		with (
			patch("vms.faces._load_models"),
			patch("vms.faces.generate_presigned_view_url"),
			patch("vms.faces._download_file", side_effect=OSError("missing")),
		):
			index_asset_faces(photo)

		self.assertNotIn(photo, _pending_photo_names())

	def test_photos_stay_pending_when_models_cannot_load(self):
		photo = self._photo()
		frappe.db.set_value("VMS Asset", photo, "face_index_key", None)
		frappe.db.commit()

		with patch("vms.faces._load_models", side_effect=OSError("offline")):
			index_asset_faces(photo)

		self.assertIn(photo, _pending_photo_names())
