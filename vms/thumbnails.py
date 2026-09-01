import os
import shutil
import subprocess
import tempfile

import frappe
import requests
from PIL import Image, ImageOps

from vms.r2 import generate_presigned_view_url
from vms.raw_images import is_raw, open_raw_preview

IMAGE_MIME_PREFIXES = ("image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff")
THUMB_MAX_WIDTH = 640
THUMB_QUALITY = 60
PREVIEW_MAX_WIDTH = 2048
PREVIEW_QUALITY = 80


def _is_image(file_type):
	return file_type and any(file_type.startswith(prefix) for prefix in IMAGE_MIME_PREFIXES)


def _download_file(presigned_url, dest_path):
	resp = requests.get(presigned_url, stream=True, timeout=120)
	resp.raise_for_status()
	with open(dest_path, "wb") as f:
		for chunk in resp.iter_content(chunk_size=1024 * 1024):
			f.write(chunk)


def _save_resized(img, dest_path, max_width, quality):
	if img.width > max_width:
		ratio = max_width / img.width
		img = img.resize((max_width, max(1, int(img.height * ratio))), Image.LANCZOS)
	img.save(dest_path, "WEBP", quality=quality)


def _generate_image_thumbnail(src_path, thumb_path):
	"""Resize image to max THUMB_MAX_WIDTH wide, save as WebP."""
	img = Image.open(src_path)
	img = ImageOps.exif_transpose(img)
	img = img.convert("RGB")
	_save_resized(img, thumb_path, THUMB_MAX_WIDTH, THUMB_QUALITY)


def _generate_raw_thumbnail(src_path, thumb_path, preview_path, asset_name):
	try:
		img = open_raw_preview(src_path)
	except Exception:
		frappe.logger("vms").error(f"RAW preview extraction failed for {asset_name}", exc_info=True)
		return False

	_save_resized(img, thumb_path, THUMB_MAX_WIDTH, THUMB_QUALITY)
	_save_resized(img, preview_path, PREVIEW_MAX_WIDTH, PREVIEW_QUALITY)
	return True


def _generate_video_thumbnail(video_path, thumb_path, asset_name):
	"""Extract a single frame at 1s using FFmpeg, output as WebP."""
	result = subprocess.run(
		[
			"ffmpeg",
			"-ss",
			"1",
			"-i",
			video_path,
			"-vframes",
			"1",
			"-c:v",
			"libwebp",
			"-quality",
			str(THUMB_QUALITY),
			thumb_path,
		],
		capture_output=True,
		timeout=60,
	)

	if result.returncode != 0 or not os.path.exists(thumb_path):
		frappe.logger("vms").error(
			f"FFmpeg failed for {asset_name}: {result.stderr.decode(errors='replace')}"
		)
		return False
	return True


def _probe_duration(video_path, asset_name):
	"""Return the video's duration in seconds via ffprobe, or None if it fails."""
	result = subprocess.run(
		[
			"ffprobe",
			"-v",
			"error",
			"-show_entries",
			"format=duration",
			"-of",
			"csv=p=0",
			video_path,
		],
		capture_output=True,
		text=True,
		timeout=60,
	)

	if result.returncode != 0:
		frappe.logger("vms").error(f"ffprobe failed for {asset_name}: {result.stderr}")
		return None

	try:
		return float(result.stdout.strip())
	except ValueError:
		return None


def _attach_webp(asset_name, path, file_name):
	# nosemgrep: frappe-semgrep-rules.rules.security.frappe-security-file-traversal
	with open(path, "rb") as f:
		content = f.read()

	file_doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": file_name,
			"attached_to_doctype": "VMS Asset",
			"attached_to_name": asset_name,
			"content": content,
			"is_private": 0,
		}
	)
	file_doc.save(ignore_permissions=True)
	return file_doc.file_url


def generate_thumbnail(asset_name):
	"""Generate a WebP thumbnail from an asset (runs as background job).

	For videos: extracts a single frame at 1s using FFmpeg, and probes the
	duration with ffprobe.
	For images: resizes to max 640px wide.
	Saves as a public Frappe File and sets thumbnail_url.
	"""
	tmp_dir = tempfile.mkdtemp(prefix="vms_thumb_")
	try:
		asset = frappe.get_doc("VMS Asset", asset_name)
		if not asset.r2_key:
			return

		raw = is_raw(asset.file_type, asset.file_name)
		is_video = not raw and not _is_image(asset.file_type)
		needs_duration = is_video and not asset.duration_seconds
		needs_preview = raw and not asset.preview_url

		# nothing left to compute, don't pay for the download
		if asset.thumbnail_url and not needs_duration and not needs_preview:
			return

		presigned_url = generate_presigned_view_url(asset.r2_key)
		ext = asset.file_name.rsplit(".", 1)[-1].lower() if "." in asset.file_name else "bin"
		src_path = os.path.join(tmp_dir, f"input.{ext}")
		thumb_path = os.path.join(tmp_dir, "thumb.webp")
		preview_path = os.path.join(tmp_dir, "preview.webp")

		_download_file(presigned_url, src_path)

		if needs_duration:
			duration = _probe_duration(src_path, asset_name)
			if duration:
				frappe.db.set_value("VMS Asset", asset_name, "duration_seconds", duration)
				frappe.db.commit()

		if asset.thumbnail_url and not needs_preview:
			return

		if raw:
			if not _generate_raw_thumbnail(src_path, thumb_path, preview_path, asset_name):
				return
		elif _is_image(asset.file_type):
			_generate_image_thumbnail(src_path, thumb_path)
		else:
			if not _generate_video_thumbnail(src_path, thumb_path, asset_name):
				return

		thumbnail_url = None
		if not asset.thumbnail_url:
			thumbnail_url = _attach_webp(asset_name, thumb_path, f"{asset_name}.webp")

		preview_url = None
		if needs_preview:
			preview_url = _attach_webp(asset_name, preview_path, f"{asset_name}-preview.webp")

		asset.reload()
		if thumbnail_url:
			asset.thumbnail_url = thumbnail_url
		if preview_url:
			asset.preview_url = preview_url
		asset.save(ignore_permissions=True)
		frappe.db.commit()

	except Exception:
		frappe.logger("vms").error(
			f"Thumbnail generation failed for {asset_name}",
			exc_info=True,
		)
	finally:
		shutil.rmtree(tmp_dir, ignore_errors=True)
