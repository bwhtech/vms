import frappe

from vms.raw_images import RAW_MIME_TYPES
from vms.thumbnails import generate_thumbnail


def execute():
	for extension, mime in RAW_MIME_TYPES.items():
		assets = frappe.get_all(
			"VMS Asset",
			filters=[
				["file_name", "like", f"%{extension}"],
				["file_type", "!=", mime],
			],
			fields=["name", "file_name"],
		)

		for asset in assets:
			if not asset.file_name.lower().endswith(extension):
				continue
			try:
				frappe.db.set_value("VMS Asset", asset.name, "file_type", mime)
				frappe.db.commit()
				generate_thumbnail(asset.name)
			except Exception:
				frappe.log_error(f"RAW backfill failed for {asset.name}")
