import os
import subprocess
import tempfile
import uuid
from urllib.request import urlretrieve

import frappe
from frappe import _

from vms.api import is_convertible_video
from vms.r2 import (
	delete_r2_object,
	generate_presigned_download_url,
	upload_r2_object,
)


def _get_extension(filename: str) -> str:
	"""Get file extension from filename."""
	if "." in filename:
		return "." + filename.rsplit(".", 1)[1].lower()
	return ".mp4"


def run_asset_conversion(asset_name: str):
	"""Background job: convert a VMS Asset to MP4 in-place (replaces original in R2)."""
	asset = frappe.get_doc("VMS Asset", asset_name)
	old_r2_key = asset.r2_key
	new_r2_key = None

	try:
		# The API checks this too, but the conversion deletes the original R2
		# object, so anything that enqueues the job directly (console, a future
		# bulk action) must not be able to destroy a non-video asset.
		if not is_convertible_video(asset):
			frappe.throw(_("Only video files can be converted to MP4"))

		_publish_conversion_progress(asset, "Processing")

		with tempfile.TemporaryDirectory() as tmpdir:
			# Download source file from R2
			ext = _get_extension(asset.file_name)
			input_path = os.path.join(tmpdir, f"input{ext}")

			frappe.logger("vms").info(f"Downloading asset for conversion: {asset_name}")
			download_url = generate_presigned_download_url(asset.r2_key, asset.file_name)
			urlretrieve(download_url, input_path)

			# Convert to MP4
			base = asset.file_name.rsplit(".", 1)[0] if "." in asset.file_name else asset.file_name
			output_name = f"{base}.mp4"
			output_path = os.path.join(tmpdir, output_name)

			frappe.logger("vms").info(f"Converting asset to MP4: {asset_name}")
			_ffmpeg_convert(input_path, output_path)

			# Upload converted file to R2
			new_size = os.path.getsize(output_path)
			project_prefix = asset.project if asset.project else "inbox"
			new_r2_key = f"{project_prefix}/{uuid.uuid4().hex}.mp4"

			frappe.logger("vms").info(f"Uploading converted file to R2: {asset_name}")
			upload_r2_object(new_r2_key, output_path, "video/mp4")

		# Update asset record
		asset.reload()
		asset.file_name = output_name
		asset.file_type = "video/mp4"
		asset.r2_key = new_r2_key
		asset.file_size = new_size
		asset.status = "Ready"
		asset.save(ignore_permissions=True)
		frappe.db.commit()

		# Delete old R2 object
		try:
			delete_r2_object(old_r2_key)
		except Exception:
			frappe.logger("vms").warning(f"Failed to delete old R2 object {old_r2_key}")

		_publish_conversion_progress(asset, "Ready")

		# Regenerate thumbnail for the new MP4
		frappe.enqueue(
			"vms.thumbnails.generate_thumbnail",
			asset_name=asset.name,
			queue="default",
			enqueue_after_commit=True,
		)

		frappe.logger("vms").info(f"Conversion complete: {asset_name}")

	except Exception as e:
		frappe.logger("vms").error(f"Conversion failed for {asset_name}: {e}")
		asset.reload()

		# If the converted file reached R2 but the asset never came to point at
		# it, nothing else references that object and nothing will clean it up.
		# The key check matters: on a failure after the save, new_r2_key is the
		# asset's live file and deleting it would destroy the asset.
		if new_r2_key and asset.r2_key != new_r2_key:
			try:
				delete_r2_object(new_r2_key)
			except Exception:
				frappe.logger("vms").warning(f"Failed to delete orphaned R2 object {new_r2_key}")

		asset.status = "Error"
		asset.save(ignore_permissions=True)
		frappe.db.commit()
		_publish_conversion_progress(asset, "Error", str(e)[:500])


def _ffmpeg_convert(input_path: str, output_path: str):
	"""Convert video to MP4. Tries fast copy-remux first, falls back to transcode."""
	# Try copy-remux first (instant if codecs are MP4-compatible)
	copy_cmd = [
		"ffmpeg",
		"-hide_banner",
		"-y",
		"-i",
		input_path,
		"-c",
		"copy",
		"-movflags",
		"+faststart",
		output_path,
	]
	result = subprocess.run(copy_cmd, capture_output=True, text=True, timeout=3600)
	if result.returncode == 0:
		return

	# Fall back to full transcode
	transcode_cmd = [
		"ffmpeg",
		"-hide_banner",
		"-y",
		"-i",
		input_path,
		"-c:v",
		"libx264",
		"-preset",
		"medium",
		"-crf",
		"23",
		"-pix_fmt",
		"yuv420p",
		"-vf",
		"scale='min(1920,iw)':-2",
		"-c:a",
		"aac",
		"-b:a",
		"160k",
		"-movflags",
		"+faststart",
		output_path,
	]
	result = subprocess.run(transcode_cmd, capture_output=True, text=True, timeout=3600)
	if result.returncode != 0:
		raise RuntimeError(f"ffmpeg conversion failed: {result.stderr[-500:]}")


def _publish_conversion_progress(asset, status, error_message=None):
	"""Send realtime update about asset conversion to whoever asked for it.

	`frappe.enqueue` records the enqueuing user and `execute_job` restores it,
	so inside the background job this is the user who clicked Convert — not
	necessarily the one who uploaded the asset.
	"""
	frappe.publish_realtime(
		"asset_conversion_progress",
		{
			"asset_name": asset.name,
			"status": status,
			"error_message": error_message,
		},
		user=frappe.session.user,
	)
