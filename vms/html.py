"""Sanitiser for the rich-text fields the frontend renders with `v-html`.

Frappe already runs `sanitize_html` on Text Editor fields, but that pass is
tuned for desk content and keeps `style`, `form`, `input` and `button`. Those
are enough to paint a full-viewport fake sign-in form inside the real origin —
no script needed — and a comment can be written by an unauthenticated visitor
holding a public review link. So the values are cleaned again here, against an
allowlist that only covers what the editor legitimately emits.
"""

import nh3

# What the tiptap CommentKit stack can produce: text formatting, lists, quotes,
# code, links, images and mentions. Anything outside this is unwrapped.
ALLOWED_TAGS = {
	"p",
	"br",
	"hr",
	"b",
	"strong",
	"i",
	"em",
	"u",
	"s",
	"ul",
	"ol",
	"li",
	"blockquote",
	"code",
	"pre",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"span",
	"div",
	"a",
	"img",
}

# Tags whose text is markup leftovers rather than content, so the content goes
# with the tag. `style` matters most: its body is CSS, and CSS alone is enough
# to cover the page.
CLEAN_CONTENT_TAGS = {
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"noscript",
	"template",
	"title",
	"textarea",
}

# `style` is deliberately absent everywhere — it is the whole defect.
ALLOWED_ATTRIBUTES = {
	"a": {"href", "title"},
	# `data-r2-key` is how the comment-image feature re-signs an expired R2 URL;
	# the rest are the tiptap image node's own attributes.
	"img": {
		"src",
		"alt",
		"title",
		"width",
		"height",
		"data-r2-key",
		"data-align",
		"data-float",
		"data-caption",
	},
	# A mention renders as
	# `<span class="mention" data-type="mention" data-id data-label>@Name</span>`.
	"span": {"data-type", "data-id", "data-label"},
	"ol": {"start"},
	"pre": {"data-language"},
	"code": {"data-language"},
}

# `class` stays off the attribute allowlist on purpose: the app ships utility
# classes that can position and size an element, so an arbitrary class value is
# another way to build the same overlay. Only the mention class is let through.
ALLOWED_CLASSES = {"span": {"mention"}}

ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}

# Comments are open to guests on a public review link, hence `nofollow`.
LINK_REL = "noopener noreferrer nofollow"


def sanitize_rich_text(html: str | None) -> str | None:
	"""Return `html` with everything outside the editor's own vocabulary removed.

	Falsy input is handed back untouched so an empty field stays empty rather
	than flipping between `None` and `""`.
	"""
	if not html:
		return html

	return nh3.clean(
		html,
		tags=ALLOWED_TAGS,
		clean_content_tags=CLEAN_CONTENT_TAGS,
		attributes=ALLOWED_ATTRIBUTES,
		allowed_classes=ALLOWED_CLASSES,
		url_schemes=ALLOWED_URL_SCHEMES,
		link_rel=LINK_REL,
		strip_comments=True,
	)
