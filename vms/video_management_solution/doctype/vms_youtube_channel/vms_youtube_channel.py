# Copyright (c) 2026, BWH and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class VMSYouTubeChannel(Document):
	_DOCTYPE_NAME = "VMS YouTube Channel"

	def on_trash(self):
		"""Keep the channel invariants whichever way a channel is deleted.

		These used to live only in `disconnect_youtube_channel`, so deleting a
		channel from the desk or the console left assets pointing at a missing
		record, no channel marked default, and a stale VMS Settings summary.
		"""
		from vms.youtube import _unlink_channel_from_assets

		_unlink_channel_from_assets(self.name)

		if self.is_default:
			successor = frappe.get_all(
				"VMS YouTube Channel",
				filters={"name": ("!=", self.name)},
				pluck="name",
				order_by="creation asc",
				limit=1,
			)
			if successor:
				frappe.db.set_value("VMS YouTube Channel", successor[0], "is_default", 1)

	def after_delete(self):
		# Settings summary reads the channel list, so it has to run once the row is gone.
		from vms.youtube import _sync_settings_summary

		_sync_settings_summary()
