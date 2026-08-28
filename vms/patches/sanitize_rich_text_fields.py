import frappe

from vms.html import sanitize_rich_text

# The fields the frontend renders with `v-html`, now cleaned on save.
RICH_TEXT_FIELDS = (
	("VMS Review Comment", "comment_text"),
	("VMS Project", "description"),
)


def execute():
	"""Re-sanitise rich text stored before `sanitize_rich_text` guarded these fields.

	Rows written earlier kept whatever Frappe's own permissive pass allowed —
	`style`, `form`, `input` — so they still render the injected markup. Cleaning
	them here is what makes the fix cover existing content.
	"""
	for doctype, fieldname in RICH_TEXT_FIELDS:
		if not frappe.db.has_column(doctype, fieldname):
			continue

		rows = frappe.get_all(
			doctype,
			filters={fieldname: ("is", "set")},
			fields=["name", fieldname],
			as_list=True,
		)
		for name, value in rows:
			cleaned = sanitize_rich_text(value)
			if cleaned == value:
				continue

			# `update_modified=False`: a sanitising sweep is not an edit, and the
			# UI sorts and labels these rows by their timestamps.
			frappe.db.set_value(doctype, name, fieldname, cleaned, update_modified=False)

	frappe.db.commit()
