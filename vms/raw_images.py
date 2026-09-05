import io
import os

from PIL import Image, ImageOps

RAW_MIME_TYPES = {
	".arw": "image/x-sony-arw",
	".cr2": "image/x-canon-cr2",
	".cr3": "image/x-canon-cr3",
	".dng": "image/x-adobe-dng",
	".nef": "image/x-nikon-nef",
	".orf": "image/x-olympus-orf",
	".raf": "image/x-fuji-raf",
	".rw2": "image/x-panasonic-rw2",
}

RAW_EXTENSIONS = frozenset(RAW_MIME_TYPES)
RAW_MIMES = frozenset(RAW_MIME_TYPES.values())

_LIBRAW_FLIP_TRANSPOSE = {
	3: Image.ROTATE_180,
	5: Image.ROTATE_90,
	6: Image.ROTATE_270,
}


def raw_mime_for(file_name: str | None) -> str | None:
	if not file_name:
		return None
	return RAW_MIME_TYPES.get(os.path.splitext(file_name)[1].lower())


def is_raw(file_type: str | None = None, file_name: str | None = None) -> bool:
	if file_type in RAW_MIMES:
		return True
	return raw_mime_for(file_name) is not None


def open_raw_preview(src_path: str) -> Image.Image:
	import rawpy

	with rawpy.imread(src_path) as raw:
		flip = raw.sizes.flip
		try:
			thumb = raw.extract_thumb()
		except rawpy.LibRawNoThumbnailError, rawpy.LibRawUnsupportedThumbnailError:
			img = Image.fromarray(raw.postprocess(half_size=True, use_camera_wb=True))
			return img.convert("RGB")

		if thumb.format == rawpy.ThumbFormat.JPEG:
			img = Image.open(io.BytesIO(thumb.data))
			img.load()
		else:
			img = Image.fromarray(thumb.data)

	tagged = img.getexif().get(0x0112, 1) not in (0, 1)
	oriented = ImageOps.exif_transpose(img)
	if not tagged and flip in _LIBRAW_FLIP_TRANSPOSE:
		oriented = oriented.transpose(_LIBRAW_FLIP_TRANSPOSE[flip])

	return oriented.convert("RGB")
