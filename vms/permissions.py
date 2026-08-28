import frappe
from frappe import _

# Roles that grant access to VMS data. Everything in the app is visible to both;
# there is no per-project sharing model yet, so this is the whole access rule.
VMS_ROLES = ("System Manager", "Video Manager")


def has_vms_access(user: str | None = None) -> bool:
	"""Whether `user` is allowed to see VMS data at all."""
	if not user:
		user = frappe.session.user

	if user == "Administrator":
		return True

	return any(role in frappe.get_roles(user) for role in VMS_ROLES)


def require_vms_access(user: str | None = None):
	"""Raise unless `user` may access VMS data.

	Whitelisted endpoints in `vms.api` hand-roll their queries with `frappe.get_all`
	and `frappe.db.count`, both of which run with permissions ignored, so the
	`permission_query_conditions` hooks below never see them. This is the guard that
	stands in for those hooks at the entry point.
	"""
	if not has_vms_access(user):
		frappe.throw(_("Not permitted"), frappe.PermissionError)


def _vms_access_condition(user):
	"""Shared body for the doctype query-condition hooks."""
	return "" if has_vms_access(user) else "1=0"


def get_project_permission_query_conditions(user):
	return _vms_access_condition(user)


def get_asset_permission_query_conditions(user):
	return _vms_access_condition(user)


def get_comment_permission_query_conditions(user):
	return _vms_access_condition(user)


def get_audit_log_permission_query_conditions(user):
	return _vms_access_condition(user)


def get_pinned_project_permission_query_conditions(user):
	"""A pin is private to whoever made it, so a user only ever lists their own rows.

	Without this any Video Manager could read, reassign or delete another user's pins
	straight through `/api/v2/document/VMS Pinned Project`, since the doctype grants
	the role full read/write/delete.
	"""
	if not user:
		user = frappe.session.user

	if not has_vms_access(user):
		return "1=0"

	return f"`tabVMS Pinned Project`.`user` = {frappe.db.escape(user)}"
