# Copyright (c) 2026, BWH and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

# Folders nest arbitrarily deep, but a runaway chain means the data is already broken —
# bail out instead of walking it forever.
MAX_FOLDER_DEPTH = 50


class VMSFolder(Document):
	def validate(self):
		self.validate_parent_folder()

	def validate_parent_folder(self):
		if not self.parent_folder:
			return

		if self.parent_folder == self.name:
			frappe.throw(_("A folder cannot be its own parent"))

		parent_project = frappe.db.get_value("VMS Folder", self.parent_folder, "project")
		if not parent_project:
			frappe.throw(_("Parent folder {0} does not exist").format(self.parent_folder))
		if parent_project != self.project:
			frappe.throw(_("Parent folder must belong to the same project"))

		# Walking up from the parent must never reach this folder again.
		ancestor = self.parent_folder
		for _i in range(MAX_FOLDER_DEPTH):
			if not ancestor:
				return
			if ancestor == self.name:
				frappe.throw(_("A folder cannot be moved inside one of its own subfolders"))
			ancestor = frappe.db.get_value("VMS Folder", ancestor, "parent_folder")

		frappe.throw(_("Folder nesting is too deep (limit {0})").format(MAX_FOLDER_DEPTH))
