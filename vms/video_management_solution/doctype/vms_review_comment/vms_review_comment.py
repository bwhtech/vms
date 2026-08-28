import frappe
from frappe.model.document import Document

from vms.html import sanitize_rich_text


class VMSReviewComment(Document):
	def before_insert(self):
		if not self.commented_by and frappe.session.user != "Guest":
			self.commented_by = frappe.session.user

	def validate(self):
		# A guest holding a public review link can write this field, and the
		# review panel renders it as HTML, so it is cleaned on the way in.
		self.comment_text = sanitize_rich_text(self.comment_text)
