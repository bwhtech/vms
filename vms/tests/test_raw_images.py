# Copyright (c) 2026, BWH and Contributors
# See license.txt

import io
import os
import tempfile
import unittest

from PIL import Image

from vms.raw_images import RAW_MIME_TYPES, is_raw, open_raw_preview, raw_mime_for


class TestRawMimeDetection(unittest.TestCase):
	def test_arw_maps_to_an_image_type(self):
		self.assertEqual(raw_mime_for("DSC02816.ARW"), "image/x-sony-arw")

	def test_detection_is_case_insensitive(self):
		self.assertEqual(raw_mime_for("dsc02816.arw"), raw_mime_for("DSC02816.ARW"))

	def test_every_supported_format_maps_to_an_image_type(self):
		for extension, mime in RAW_MIME_TYPES.items():
			self.assertTrue(
				mime.startswith("image/"),
				f"{extension} must map to image/* so the frontend treats it as a picture",
			)
			self.assertEqual(raw_mime_for(f"photo{extension}"), mime)

	def test_non_raw_files_are_not_raw(self):
		for file_name in ("clip.mp4", "photo.jpg", "notes.txt", "noextension"):
			self.assertIsNone(raw_mime_for(file_name))
			self.assertFalse(is_raw("video/mp4", file_name))

	def test_is_raw_detects_by_mime(self):
		self.assertTrue(is_raw("image/x-sony-arw", "renamed"))

	def test_is_raw_detects_legacy_octet_stream_by_extension(self):
		self.assertTrue(is_raw("application/octet-stream", "DSC02816.ARW"))

	def test_is_raw_handles_missing_values(self):
		self.assertFalse(is_raw(None, None))


def _sample_arw():
	path = os.environ.get("VMS_TEST_ARW")
	return path if path and os.path.exists(path) else None


@unittest.skipUnless(_sample_arw(), "set VMS_TEST_ARW to a .arw file to run")
class TestRawPreviewExtraction(unittest.TestCase):
	def test_preview_is_a_usable_rgb_image(self):
		img = open_raw_preview(_sample_arw())

		self.assertEqual(img.mode, "RGB")
		self.assertGreaterEqual(img.width, 640)

	def test_preview_survives_a_webp_round_trip(self):
		img = open_raw_preview(_sample_arw())

		with tempfile.TemporaryDirectory() as tmp:
			thumb_path = os.path.join(tmp, "thumb.webp")
			ratio = 640 / img.width
			img.resize((640, int(img.height * ratio)), Image.LANCZOS).save(thumb_path, "WEBP", quality=60)

			with open(thumb_path, "rb") as f:
				written = Image.open(io.BytesIO(f.read()))
				self.assertEqual(written.format, "WEBP")
				self.assertEqual(written.width, 640)
