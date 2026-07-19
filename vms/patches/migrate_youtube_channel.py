import frappe

from vms.youtube import CONNECTED_APP_NAME, _fetch_channel, _sync_settings_summary


def execute():
	"""Convert the single stored YouTube connection into a VMS YouTube Channel."""
	if frappe.db.count("VMS YouTube Channel"):
		return

	settings = frappe.get_single("VMS Settings")
	user = settings.youtube_connected_user
	if not settings.youtube_connected or not user:
		return

	token_cache_name = f"{CONNECTED_APP_NAME}-{user}"
	if not frappe.db.exists("Token Cache", token_cache_name):
		return

	token_cache = frappe.get_doc("Token Cache", token_cache_name)
	refresh_token = token_cache.get_password("refresh_token", raise_exception=False)
	if not refresh_token:
		return

	# The channel id is not stored anywhere, so ask YouTube for it
	try:
		connected_app = frappe.get_doc("Connected App", CONNECTED_APP_NAME)
		active = connected_app.get_active_token(user)
		channel = _fetch_channel(active.get_json()["access_token"])
	except Exception as e:
		frappe.log_error(f"Could not migrate YouTube connection: {e}")
		return

	doc = frappe.new_doc("VMS YouTube Channel")
	doc.channel_id = channel["id"]
	doc.channel_name = channel["name"]
	doc.refresh_token = refresh_token
	doc.connected_by = user
	doc.is_default = 1
	doc.insert(ignore_permissions=True)

	frappe.delete_doc("Token Cache", token_cache_name, ignore_permissions=True, force=True)
	_sync_settings_summary()
