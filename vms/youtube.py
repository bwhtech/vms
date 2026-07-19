import os
import tempfile

import frappe
import requests
from frappe import _

from vms.r2 import generate_presigned_download_url

CONNECTED_APP_NAME = "vms-youtube"
SCOPES = [
	"https://www.googleapis.com/auth/youtube.upload",
	"https://www.googleapis.com/auth/youtube.readonly",
]
AUTHORIZATION_URI = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URI = "https://oauth2.googleapis.com/token"
REVOCATION_URI = "https://oauth2.googleapis.com/revoke"


def _get_or_create_connected_app(client_id: str, client_secret: str):
	"""Create or update the VMS YouTube Connected App."""
	if frappe.db.exists("Connected App", CONNECTED_APP_NAME):
		app = frappe.get_doc("Connected App", CONNECTED_APP_NAME)
		app.client_id = client_id
		app.client_secret = client_secret
		app.authorization_uri = AUTHORIZATION_URI
		app.token_uri = TOKEN_URI
		app.revocation_uri = REVOCATION_URI

		# Update scopes
		app.scopes = []
		for scope in SCOPES:
			app.append("scopes", {"scope": scope})

		# Update query parameters for offline access
		app.query_parameters = []
		app.append("query_parameters", {"key": "access_type", "value": "offline"})
		app.append("query_parameters", {"key": "prompt", "value": "consent"})

		app.save(ignore_permissions=True)
		return app

	app = frappe.get_doc(
		{
			"doctype": "Connected App",
			"provider_name": "YouTube",
			"client_id": client_id,
			"client_secret": client_secret,
			"authorization_uri": AUTHORIZATION_URI,
			"token_uri": TOKEN_URI,
			"revocation_uri": REVOCATION_URI,
		}
	)

	for scope in SCOPES:
		app.append("scopes", {"scope": scope})

	app.append("query_parameters", {"key": "access_type", "value": "offline"})
	app.append("query_parameters", {"key": "prompt", "value": "consent"})

	app.insert(ignore_permissions=True, set_name=CONNECTED_APP_NAME)

	return app


def _fetch_channel(access_token: str):
	"""Fetch the authorized YouTube channel's id and title."""
	resp = requests.get(
		"https://www.googleapis.com/youtube/v3/channels",
		params={"part": "snippet", "mine": "true"},
		headers={"Authorization": f"Bearer {access_token}"},
		timeout=15,
	)
	resp.raise_for_status()
	data = resp.json()

	items = data.get("items", [])
	if not items:
		frappe.throw(_("No YouTube channel found for this Google account"))

	return {"id": items[0]["id"], "name": items[0]["snippet"]["title"]}


@frappe.whitelist()
def connect_youtube(client_id: str | None = None, client_secret: str | None = None):
	"""Save OAuth credentials, create Connected App, and return the auth URL.

	Credentials are per-site (one Google Cloud project), so connecting an
	additional channel can omit them and reuse what is already stored.
	"""
	frappe.only_for("System Manager")

	settings = frappe.get_single("VMS Settings")

	if not client_id:
		client_id = settings.youtube_client_id
		client_secret = settings.get_password("youtube_client_secret", raise_exception=False)
	else:
		settings.youtube_client_id = client_id
		settings.youtube_client_secret = client_secret
		settings.save(ignore_permissions=True)

	if not client_id or not client_secret:
		frappe.throw(_("Client ID and Client Secret are required"))

	# Create/update Connected App
	connected_app = _get_or_create_connected_app(client_id, client_secret)

	# Initiate OAuth flow
	auth_url = connected_app.initiate_web_application_flow(
		success_uri="/vms?settings=youtube&youtube_connected=1"
	)

	return {"auth_url": auth_url}


def _unlink_channel_from_assets(channel: str):
	"""Drop the link from assets published to a channel that is going away."""
	for name in frappe.get_all("VMS Asset", filters={"youtube_channel": channel}, pluck="name"):
		frappe.db.set_value("VMS Asset", name, "youtube_channel", None)


def _sync_settings_summary():
	"""Keep the VMS Settings connection flags in step with the channel list."""
	channels = frappe.get_all(
		"VMS YouTube Channel",
		fields=["channel_name", "connected_by", "is_default"],
		order_by="is_default desc, creation asc",
	)

	settings = frappe.get_single("VMS Settings")
	settings.youtube_connected = 1 if channels else 0
	settings.youtube_connected_user = channels[0].connected_by if channels else None
	settings.youtube_channel_name = channels[0].channel_name if channels else None
	settings.save(ignore_permissions=True)


@frappe.whitelist()
def finalize_youtube_connection():
	"""Called after OAuth redirect — turn the fresh token into a channel record.

	The Connected App holds one Token Cache per user, so the token is copied
	onto a VMS YouTube Channel and the cache is cleared. That frees the
	Connected App for the next channel while keeping a single redirect URI.
	"""
	frappe.only_for("System Manager")

	if not frappe.db.exists("Connected App", CONNECTED_APP_NAME):
		frappe.throw(_("YouTube Connected App not found. Please connect again."))

	connected_app = frappe.get_doc("Connected App", CONNECTED_APP_NAME)

	try:
		token_cache = connected_app.get_active_token(frappe.session.user)
	except Exception:
		frappe.throw(_("YouTube authorization failed. Please try connecting again."))

	if not token_cache:
		frappe.throw(_("No YouTube token found. Please connect again."))

	token = token_cache.get_json()
	if not token.get("refresh_token"):
		frappe.throw(
			_(
				"Google did not return a refresh token. Please remove VMS from your Google account's third-party access and connect again."
			)
		)

	channel = _fetch_channel(token["access_token"])

	existing = frappe.db.exists("VMS YouTube Channel", {"channel_id": channel["id"]})
	doc = (
		frappe.get_doc("VMS YouTube Channel", existing) if existing else frappe.new_doc("VMS YouTube Channel")
	)
	doc.channel_id = channel["id"]
	doc.channel_name = channel["name"]
	doc.refresh_token = token["refresh_token"]
	doc.connected_by = frappe.session.user
	if not existing and not frappe.db.count("VMS YouTube Channel"):
		doc.is_default = 1
	doc.save(ignore_permissions=True)

	# Free the cache so the next connect starts a clean authorization
	frappe.delete_doc("Token Cache", token_cache.name, ignore_permissions=True, force=True)

	_sync_settings_summary()

	return {"connected": True, "channel": doc.name, "channel_name": doc.channel_name}


@frappe.whitelist()
def disconnect_youtube_channel(channel: str):
	"""Remove a single connected channel."""
	frappe.only_for("System Manager")

	if not frappe.db.exists("VMS YouTube Channel", channel):
		frappe.throw(_("Channel {0} does not exist").format(channel))

	was_default = frappe.db.get_value("VMS YouTube Channel", channel, "is_default")
	_unlink_channel_from_assets(channel)
	frappe.delete_doc("VMS YouTube Channel", channel, ignore_permissions=True, force=True)

	if was_default:
		remaining = frappe.get_all("VMS YouTube Channel", pluck="name", order_by="creation asc", limit=1)
		if remaining:
			frappe.db.set_value("VMS YouTube Channel", remaining[0], "is_default", 1)

	_sync_settings_summary()

	return {"status": "ok"}


@frappe.whitelist()
def set_default_youtube_channel(channel: str):
	"""Mark one channel as the default pick for uploads."""
	frappe.only_for("System Manager")

	if not frappe.db.exists("VMS YouTube Channel", channel):
		frappe.throw(_("Channel {0} does not exist").format(channel))

	for name in frappe.get_all("VMS YouTube Channel", pluck="name"):
		frappe.db.set_value("VMS YouTube Channel", name, "is_default", 1 if name == channel else 0)

	_sync_settings_summary()

	return {"status": "ok"}


@frappe.whitelist(methods=["GET"])
def get_youtube_channels():
	"""List the connected YouTube channels, default first."""
	return frappe.get_all(
		"VMS YouTube Channel",
		fields=["name", "channel_name", "channel_id", "connected_by", "is_default"],
		order_by="is_default desc, creation asc",
	)


@frappe.whitelist()
def disconnect_youtube():
	"""Disconnect YouTube entirely — remove every channel and the Connected App."""
	frappe.only_for("System Manager")

	for name in frappe.get_all("VMS YouTube Channel", pluck="name"):
		_unlink_channel_from_assets(name)
		frappe.delete_doc("VMS YouTube Channel", name, ignore_permissions=True, force=True)

	for name in frappe.get_all("Token Cache", filters={"connected_app": CONNECTED_APP_NAME}, pluck="name"):
		frappe.delete_doc("Token Cache", name, ignore_permissions=True, force=True)

	if frappe.db.exists("Connected App", CONNECTED_APP_NAME):
		frappe.delete_doc("Connected App", CONNECTED_APP_NAME, ignore_permissions=True, force=True)

	_sync_settings_summary()

	return {"connected": False}


@frappe.whitelist(methods=["GET"])
def get_youtube_redirect_uri():
	"""Return the OAuth redirect URI that must be registered in Google Cloud Console."""
	base_url = frappe.utils.get_url()
	callback_path = "api/method/frappe.integrations.doctype.connected_app.connected_app.callback"
	return {"redirect_uri": f"{base_url}/{callback_path}/{CONNECTED_APP_NAME}"}


@frappe.whitelist(methods=["GET"])
def get_youtube_status():
	"""Return current YouTube connection status."""
	settings = frappe.get_single("VMS Settings")
	channels = get_youtube_channels()

	return {
		"connected": bool(channels),
		"channel_name": channels[0].channel_name if channels else "",
		"has_credentials": bool(settings.youtube_client_id),
		"channels": channels,
	}


def channel_display_name(channel: str | None):
	"""Name of a connected channel, or "" if it is unset or since removed."""
	if not channel:
		return ""

	return frappe.db.get_value("VMS YouTube Channel", channel, "channel_name") or ""


def _resolve_channel(channel: str | None):
	"""Return the channel to publish to, falling back to the default one."""
	if channel:
		if not frappe.db.exists("VMS YouTube Channel", channel):
			frappe.throw(_("Selected YouTube channel is no longer connected"))
		return channel

	channels = frappe.get_all(
		"VMS YouTube Channel", pluck="name", order_by="is_default desc, creation asc", limit=1
	)
	if not channels:
		frappe.throw(_("YouTube is not connected. Please connect in Settings."))

	return channels[0]


@frappe.whitelist()
def upload_to_youtube(
	asset_name: str,
	title: str,
	description: str = "",
	privacy_status: str = "unlisted",
	channel: str | None = None,
):
	"""Validate and enqueue a YouTube upload job."""
	if not frappe.db.exists("VMS Asset", asset_name):
		frappe.throw(_("Asset {0} does not exist").format(asset_name))

	channel = _resolve_channel(channel)

	asset = frappe.get_doc("VMS Asset", asset_name)
	if not asset.r2_key:
		frappe.throw(_("Asset has no uploaded file"))

	if asset.youtube_upload_status in ("Queued", "Uploading"):
		frappe.throw(_("Upload is already in progress"))

	if privacy_status not in ("public", "unlisted", "private"):
		frappe.throw(_("Invalid privacy status"))

	# Mark as queued
	frappe.db.set_value(
		"VMS Asset",
		asset_name,
		{"youtube_upload_status": "Queued", "youtube_channel": channel},
	)
	frappe.db.commit()

	frappe.enqueue(
		"vms.youtube.process_youtube_upload",
		asset_name=asset_name,
		title=title,
		description=description,
		privacy_status=privacy_status,
		channel=channel,
		queue="default",
		enqueue_after_commit=True,
		timeout=3600,
	)

	return {"status": "ok", "youtube_upload_status": "Queued"}


@frappe.whitelist(methods=["GET"])
def get_youtube_upload_status(asset_name: str):
	"""Get the YouTube upload status for an asset."""
	if not frappe.db.exists("VMS Asset", asset_name):
		frappe.throw(_("Asset {0} does not exist").format(asset_name))

	data = frappe.db.get_value(
		"VMS Asset",
		asset_name,
		["youtube_upload_status", "youtube_video_id", "youtube_video_url", "youtube_channel"],
		as_dict=True,
	)

	return {
		"youtube_upload_status": data.youtube_upload_status or "",
		"youtube_video_id": data.youtube_video_id or "",
		"youtube_video_url": data.youtube_video_url or "",
		"youtube_channel_name": channel_display_name(data.youtube_channel),
	}


@frappe.whitelist()
def reset_youtube_upload(asset_name: str):
	"""Reset YouTube upload status to allow re-upload."""
	if not frappe.db.exists("VMS Asset", asset_name):
		frappe.throw(_("Asset {0} does not exist").format(asset_name))

	frappe.db.set_value(
		"VMS Asset",
		asset_name,
		{
			"youtube_upload_status": None,
			"youtube_video_id": None,
			"youtube_video_url": None,
			"youtube_channel": None,
		},
	)

	return {"status": "ok"}


def process_youtube_upload(
	asset_name: str,
	title: str,
	description: str,
	privacy_status: str,
	channel: str | None = None,
):
	"""Background job: download from R2 and upload to YouTube."""
	from google.oauth2.credentials import Credentials
	from googleapiclient.discovery import build
	from googleapiclient.http import MediaFileUpload

	asset = frappe.get_doc("VMS Asset", asset_name)

	try:
		frappe.db.set_value("VMS Asset", asset_name, "youtube_upload_status", "Uploading")
		frappe.db.commit()

		frappe.publish_realtime(
			"youtube_upload_progress",
			{"asset_name": asset_name, "stage": "downloading", "percent": 0},
		)

		settings = frappe.get_single("VMS Settings")

		channel_doc = frappe.get_doc("VMS YouTube Channel", _resolve_channel(channel))
		refresh_token = channel_doc.get_password("refresh_token", raise_exception=False)

		if not refresh_token:
			raise Exception(f"No stored token for channel {channel_doc.channel_name}. Please reconnect it.")

		# google-auth exchanges the refresh token for an access token on first use
		credentials = Credentials(
			token=None,
			refresh_token=refresh_token,
			token_uri=TOKEN_URI,
			client_id=settings.youtube_client_id,
			client_secret=settings.get_password("youtube_client_secret"),
			scopes=SCOPES,
		)

		youtube = build("youtube", "v3", credentials=credentials)

		# Download video from R2 to temp file
		with tempfile.TemporaryDirectory() as tmpdir:
			ext = os.path.splitext(asset.file_name)[1] or ".mp4"
			video_path = os.path.join(tmpdir, f"upload{ext}")

			download_url = generate_presigned_download_url(asset.r2_key, asset.file_name)
			frappe.logger().info(f"Downloading {asset.file_name} from R2 for YouTube upload")

			resp = requests.get(download_url, stream=True, timeout=30)
			resp.raise_for_status()

			total_size = int(resp.headers.get("content-length", 0))
			downloaded = 0

			with open(video_path, "wb") as f:
				for chunk in resp.iter_content(chunk_size=10 * 1024 * 1024):
					f.write(chunk)
					downloaded += len(chunk)
					if total_size:
						percent = int((downloaded / total_size) * 40)  # 0-40% for download
						frappe.publish_realtime(
							"youtube_upload_progress",
							{"asset_name": asset_name, "stage": "downloading", "percent": percent},
						)

			frappe.publish_realtime(
				"youtube_upload_progress",
				{"asset_name": asset_name, "stage": "uploading", "percent": 40},
			)

			# Upload to YouTube
			body = {
				"snippet": {
					"title": title,
					"description": description,
					"categoryId": "22",  # People & Blogs
				},
				"status": {
					"privacyStatus": privacy_status,
				},
			}

			media = MediaFileUpload(
				video_path,
				mimetype=asset.file_type or "video/mp4",
				resumable=True,
				chunksize=10 * 1024 * 1024,
			)

			request = youtube.videos().insert(
				part="snippet,status",
				body=body,
				media_body=media,
			)

			response = None
			while response is None:
				status, response = request.next_chunk()
				if status:
					percent = 40 + int(status.progress() * 60)  # 40-100% for upload
					frappe.publish_realtime(
						"youtube_upload_progress",
						{"asset_name": asset_name, "stage": "uploading", "percent": percent},
					)

			video_id = response["id"]
			video_url = f"https://www.youtube.com/watch?v={video_id}"

			frappe.db.set_value(
				"VMS Asset",
				asset_name,
				{
					"youtube_upload_status": "Complete",
					"youtube_video_id": video_id,
					"youtube_video_url": video_url,
				},
			)
			frappe.db.commit()

			frappe.publish_realtime(
				"youtube_upload_progress",
				{
					"asset_name": asset_name,
					"stage": "complete",
					"percent": 100,
					"video_id": video_id,
					"video_url": video_url,
				},
			)

			frappe.logger().info(f"YouTube upload complete: {video_url}")

	except Exception as e:
		frappe.log_error(f"YouTube upload failed for {asset_name}: {e}")
		frappe.db.set_value("VMS Asset", asset_name, "youtube_upload_status", "Error")
		frappe.db.commit()

		error_message = str(e)

		# Extract readable error from Google API errors
		try:
			from googleapiclient.errors import HttpError

			if isinstance(e, HttpError):
				import json

				error_detail = json.loads(e.content.decode())
				error_message = error_detail.get("error", {}).get("message", str(e))
		except Exception:
			pass

		frappe.publish_realtime(
			"youtube_upload_progress",
			{"asset_name": asset_name, "stage": "error", "percent": 0, "error": error_message},
		)
