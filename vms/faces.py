import base64
import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path

import frappe
import numpy as np
from frappe import _
from frappe.query_builder.functions import Count, Max
from frappe.utils.synchronization import filelock
from PIL import Image, ImageOps

from vms.api import _folder_subtree, _trashed_folders
from vms.permissions import require_vms_access
from vms.r2 import generate_presigned_view_url
from vms.raw_images import is_raw, open_raw_preview
from vms.thumbnails import _download_file, _is_image

MODEL_BASE_URL = "https://github.com/opencv/opencv_zoo/raw/47534e27c9851bb1128ccc0102f1145e27f23f98/models"
DETECTOR_MODEL = "face_detection_yunet_2023mar.onnx"
RECOGNIZER_MODEL = "face_recognition_sface_2021dec.onnx"
MODEL_URLS = {
	DETECTOR_MODEL: f"{MODEL_BASE_URL}/face_detection_yunet/{DETECTOR_MODEL}",
	RECOGNIZER_MODEL: f"{MODEL_BASE_URL}/face_recognition_sface/{RECOGNIZER_MODEL}",
}

MAX_IMAGE_SIDE = 1920
MIN_FACE_PX = 40
DETECTION_THRESHOLD = 0.8
MATCH_THRESHOLD = 0.4
AVATAR_PADDING = 1.4
CLUSTER_LOCK = "vms_face_clustering"

_models = {}


def faces_enabled() -> bool:
	return bool(frappe.db.get_single_value("VMS Settings", "face_recognition_enabled"))


def is_photo(file_type: str | None, file_name: str | None) -> bool:
	return is_raw(file_type, file_name) or bool(_is_image(file_type))


def _model_path(name: str) -> Path:
	cache_dir = Path(frappe.get_site_path(".cache", "faces"))
	path = cache_dir / name
	if path.exists():
		return path

	cache_dir.mkdir(parents=True, exist_ok=True)
	partial = cache_dir / f"{name}.{uuid.uuid4().hex}.part"
	_download_file(MODEL_URLS[name], partial)
	os.replace(partial, path)
	return path


def _load_models():
	if not _models:
		import cv2

		_models["detector"] = cv2.FaceDetectorYN.create(
			str(_model_path(DETECTOR_MODEL)), "", (320, 320), DETECTION_THRESHOLD
		)
		_models["recognizer"] = cv2.FaceRecognizerSF.create(str(_model_path(RECOGNIZER_MODEL)), "")
	return _models["detector"], _models["recognizer"]


def _encode(vector) -> str:
	return base64.b64encode(np.asarray(vector, dtype=np.float32).tobytes()).decode()


def _decode(value: str) -> np.ndarray:
	return np.frombuffer(base64.b64decode(value), dtype=np.float32)


def _box_area(box) -> float:
	if isinstance(box, str):
		box = json.loads(box)
	return box[2] * box[3] if box else 0.0


def _open_photo(path: str, file_type: str | None, file_name: str | None) -> Image.Image:
	if is_raw(file_type, file_name):
		return open_raw_preview(path)
	return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def _square_box(x, y, w, h, width, height) -> list[float]:
	"""A padded square around the face, in pixels, as [x, y, w, h] fractions of the image."""
	side = min(max(w, h) * AVATAR_PADDING, width, height)
	left = min(max(0.0, x + w / 2 - side / 2), width - side)
	top = min(max(0.0, y + h / 2 - side / 2), height - side)
	return [round(left / width, 4), round(top / height, 4), round(side / width, 4), round(side / height, 4)]


def detect_faces(img: Image.Image) -> list[dict]:
	"""Faces in an upright RGB image: square avatar box, detection score and unit embedding."""
	detector, recognizer = _load_models()

	img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
	pixels = np.ascontiguousarray(np.asarray(img)[:, :, ::-1])
	height, width = pixels.shape[:2]

	detector.setInputSize((width, height))
	_, detections = detector.detect(pixels)

	faces = []
	for row in detections if detections is not None else []:
		x, y, w, h = (float(v) for v in row[:4])
		if min(w, h) < MIN_FACE_PX:
			continue

		embedding = recognizer.feature(recognizer.alignCrop(pixels, row)).flatten()
		faces.append(
			{
				"box": _square_box(x, y, w, h, width, height),
				"score": float(row[-1]),
				"embedding": embedding / np.linalg.norm(embedding),
			}
		)
	return faces


def index_asset_faces(asset_name: str):
	"""Detect faces in a photo asset and assign each to a person (runs as background job)."""
	if not faces_enabled():
		return

	asset = frappe.db.get_value("VMS Asset", asset_name, ["r2_key", "file_type", "file_name"], as_dict=True)
	if not asset or not asset.r2_key or not is_photo(asset.file_type, asset.file_name):
		return

	try:
		_load_models()
	except Exception:
		frappe.logger("vms").error("Face models could not be loaded", exc_info=True)
		return

	tmp_dir = tempfile.mkdtemp(prefix="vms_faces_")
	try:
		src_path = os.path.join(tmp_dir, "source")
		_download_file(generate_presigned_view_url(asset.r2_key), src_path)
		faces = detect_faces(_open_photo(src_path, asset.file_type, asset.file_name))

		with filelock(CLUSTER_LOCK, timeout=120):
			# a newer version landed while we were detecting; its own job indexes it
			if frappe.db.get_value("VMS Asset", asset_name, "r2_key") != asset.r2_key:
				return

			remove_asset_faces(asset_name, prune=False)
			matched = set()
			for face in faces:
				matched.add(_add_face(asset_name, face, exclude=matched))
			_prune_empty_people()
			frappe.db.set_value(
				"VMS Asset", asset_name, "face_index_key", asset.r2_key, update_modified=False
			)
			frappe.db.commit()  # nosemgrep: frappe-semgrep-rules.rules.frappe-manual-commit
	except Exception:
		frappe.db.rollback()
		frappe.logger("vms").error(f"Face indexing failed for {asset_name}", exc_info=True)
		frappe.db.set_value("VMS Asset", asset_name, "face_index_key", asset.r2_key, update_modified=False)
		frappe.db.commit()  # nosemgrep: frappe-semgrep-rules.rules.frappe-manual-commit
	finally:
		shutil.rmtree(tmp_dir, ignore_errors=True)


def _closest_person(embedding: np.ndarray, exclude: set[str]):
	rows = [
		row
		for row in frappe.get_all("VMS Person", fields=["name", "embedding_sum"])
		if row.name not in exclude and row.embedding_sum
	]
	if not rows:
		return None

	centroids = np.stack([_decode(row.embedding_sum) for row in rows])
	centroids /= np.linalg.norm(centroids, axis=1, keepdims=True)
	scores = centroids @ embedding
	best = int(np.argmax(scores))
	if scores[best] < MATCH_THRESHOLD:
		return None
	return frappe.get_doc("VMS Person", rows[best].name)


def _add_face(asset_name: str, face: dict, exclude: set[str]) -> str:
	embedding = face["embedding"]
	person = _closest_person(embedding, exclude) or frappe.get_doc(
		{"doctype": "VMS Person", "face_count": 0, "embedding_sum": _encode(np.zeros_like(embedding))}
	).insert(ignore_permissions=True)

	face_doc = frappe.get_doc(
		{
			"doctype": "VMS Face",
			"asset": asset_name,
			"person": person.name,
			"box": json.dumps(face["box"]),
			"score": face["score"],
			"embedding": _encode(embedding),
		}
	).insert(ignore_permissions=True)

	previous_sum = _decode(person.embedding_sum) if person.face_count else np.zeros_like(embedding)
	person.embedding_sum = _encode(previous_sum + embedding)
	person.face_count = (person.face_count or 0) + 1
	cover_box = person.cover_face and frappe.db.get_value("VMS Face", person.cover_face, "box")
	if not cover_box or _box_area(face["box"]) > _box_area(cover_box):
		person.cover_face = face_doc.name
	person.save(ignore_permissions=True)
	return person.name


def remove_asset_faces(asset_name: str, prune: bool = True):
	"""Drop an asset's faces and take them out of their people. Caller holds CLUSTER_LOCK."""
	faces = frappe.get_all("VMS Face", filters={"asset": asset_name}, fields=["name", "person", "embedding"])
	frappe.db.delete("VMS Face", {"asset": asset_name})
	for face in faces:
		if face.person:
			_detach_face(face)
	if prune:
		_prune_empty_people()


def _detach_face(face):
	person = frappe.get_doc("VMS Person", face.person)
	person.face_count = max(0, (person.face_count or 0) - 1)
	if person.face_count:
		person.embedding_sum = _encode(_decode(person.embedding_sum) - _decode(face.embedding))
	if person.cover_face == face.name:
		person.cover_face = _largest_face(person.name)
	person.save(ignore_permissions=True)


def _prune_empty_people():
	frappe.db.delete("VMS Person", {"face_count": ["<=", 0]})


def _largest_face(person_name: str) -> str | None:
	faces = frappe.get_all("VMS Face", filters={"person": person_name}, fields=["name", "box"])
	return max(faces, key=lambda face: _box_area(face.box)).name if faces else None


def _merge_people(source: str, target: str):
	source_doc = frappe.get_doc("VMS Person", source)
	target_doc = frappe.get_doc("VMS Person", target)

	frappe.db.set_value("VMS Face", {"person": source}, "person", target, update_modified=False)
	target_doc.embedding_sum = _encode(_decode(target_doc.embedding_sum) + _decode(source_doc.embedding_sum))
	target_doc.face_count = (target_doc.face_count or 0) + (source_doc.face_count or 0)
	target_doc.cover_face = _largest_face(target)
	target_doc.save(ignore_permissions=True)
	frappe.db.delete("VMS Person", source)


@frappe.whitelist(methods=["POST"])
def rename_person(person: str, person_name: str = ""):
	"""Name a person. Using another person's name merges the two into that person."""
	require_vms_access()

	doc = frappe.get_doc("VMS Person", person)
	doc.check_permission("write")

	person_name = (person_name or "").strip()
	if len(person_name) > 140:
		frappe.throw(_("Name is too long (max 140 chars)"))

	existing = person_name and frappe.db.get_value(
		"VMS Person", {"person_name": person_name, "name": ["!=", person]}
	)
	if existing:
		with filelock(CLUSTER_LOCK, timeout=120):
			_merge_people(source=person, target=existing)
		return {"person": existing, "merged": True}

	doc.person_name = person_name or None
	doc.save()
	return {"person": person, "merged": False}


@frappe.whitelist(methods=["GET"])
def get_project_people(project: str, folder: str | None = None):
	"""People in a project's live photos, scoped like `vms.api.get_project_tags`."""
	require_vms_access()

	if not frappe.db.exists("VMS Project", project):
		frappe.throw(_("Project {0} does not exist").format(project))

	Face = frappe.qb.DocType("VMS Face")
	Asset = frappe.qb.DocType("VMS Asset")
	Person = frappe.qb.DocType("VMS Person")
	Cover = frappe.qb.DocType("VMS Face").as_("cover")
	CoverAsset = frappe.qb.DocType("VMS Asset").as_("cover_asset")

	query = (
		frappe.qb.from_(Face)
		.inner_join(Asset)
		.on(Asset.name == Face.asset)
		.inner_join(Person)
		.on(Person.name == Face.person)
		.left_join(Cover)
		.on(Cover.name == Person.cover_face)
		.left_join(CoverAsset)
		.on(CoverAsset.name == Cover.asset)
		.select(
			Person.name,
			Max(Person.person_name).as_("person_name"),
			Count(Face.asset).distinct().as_("count"),
			Max(Cover.box).as_("cover_box"),
			Max(CoverAsset.thumbnail_url).as_("cover_thumbnail"),
		)
		.where(Asset.project == project)
		.where(Asset.deleted_at.isnull())
		.where(Asset.status != "Uploading")
		.groupby(Person.name)
	)
	if folder:
		query = query.where(Asset.folder.isin(_folder_subtree(folder)))
	else:
		trashed = _trashed_folders(project)
		if trashed:
			query = query.where(Asset.folder.isnull() | Asset.folder.notin(trashed))

	people = sorted(
		query.run(as_dict=True),
		key=lambda person: (person.person_name is None, -person.count, person.person_name or ""),
	)
	for person in people:
		person["cover_box"] = json.loads(person.cover_box) if person.cover_box else None
	return {"people": people}


def _pending_photo_names() -> list[str]:
	rows = frappe.db.sql(
		"""
		SELECT name, file_type, file_name
		FROM `tabVMS Asset`
		WHERE status = 'Ready'
			AND deleted_at IS NULL
			AND IFNULL(r2_key, '') != ''
			AND IFNULL(face_index_key, '') != r2_key
		ORDER BY creation ASC
		""",
		as_dict=True,
	)
	return [row.name for row in rows if is_photo(row.file_type, row.file_name)]


def index_pending_photos():
	for asset_name in _pending_photo_names():
		index_asset_faces(asset_name)


@frappe.whitelist(methods=["POST"])
def scan_existing_photos():
	"""Queue face detection for every photo that hasn't been scanned in its current version."""
	frappe.only_for("System Manager")

	if not faces_enabled():
		frappe.throw(_("Turn on face recognition first"))

	pending = len(_pending_photo_names())
	if pending:
		frappe.enqueue(
			"vms.faces.index_pending_photos",
			queue="long",
			timeout=6 * 60 * 60,
			job_id="vms_faces_scan_existing",
			deduplicate=True,
		)
	return {"pending": pending}
