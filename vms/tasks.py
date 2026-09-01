def purge_expired_trash():
	"""Permanently delete trashed assets/folders older than the configured retention period."""
	from vms.deletion import purge_expired_trash

	purge_expired_trash()
