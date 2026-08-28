import re

import frappe
from frappe import _
from frappe.model.document import Document

AVATAR_DATA_URI = re.compile(r"^data:image/svg\+xml[;,]", re.IGNORECASE)


class VMSProject(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		avatar: DF.LongText | None
		avatar_options: DF.SmallText | None
		avatar_seed: DF.Data | None
		avatar_style: DF.Data | None
		color: DF.Literal["", "gray", "blue", "green", "amber", "red", "violet"]
		description: DF.TextEditor | None
		due_date: DF.Date | None
		icon: DF.Data | None
		naming_series: DF.Literal["VMS-PROJ-.#####"]
		owner_user: DF.Link | None
		project_name: DF.Data
		share_token: DF.Data | None
		status: DF.Literal["Open", "In Progress", "In Review", "Completed", "Archived"]
		thumbnail_url: DF.Data | None
	# end: auto-generated types

	def validate(self):
		self._validate_avatar()

	def _validate_avatar(self):
		"""Keep `avatar` to the one shape the frontend will render.

		An SVG can carry script, so the client only ever puts the value in an
		`<img src>` and only after checking the prefix. Repeating the check here
		means a value that could never be drawn also never reaches the row.
		"""
		if not self.avatar:
			return

		self.avatar = self.avatar.strip()
		if not AVATAR_DATA_URI.match(self.avatar):
			frappe.throw(
				_("Avatar must be an SVG data URI (data:image/svg+xml,…)"),
				title=_("Invalid Avatar"),
			)
