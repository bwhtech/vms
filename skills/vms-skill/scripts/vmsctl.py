#!/usr/bin/env python3
"""vmsctl: browse, pull, organise and upload VMS videos from the CLI, via frappectl.

Address things by path, starting at the project name: 'Acme Launch/Raw/Day 1/clip.mp4'.
An ID (VMS-PROJ-…, VMS-FLD-…, VMS-ASSET-…) works anywhere a path does.

    export VMS_SITE=<frappectl profile>

reference/cli.md has worked examples.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from vmstool import read_cmds as r
from vmstool import write_cmds as w
from vmstool.client import VmsError
from vmstool.session import Session


def main(argv=None) -> int:
	args = parser().parse_args(argv)
	try:
		args.run(Session(args.site or os.environ.get("VMS_SITE")), args)
	except VmsError as e:
		print(f"error: {e}", file=sys.stderr)
		return 1
	except KeyboardInterrupt:
		return 130
	return 0


def parser() -> argparse.ArgumentParser:
	p = argparse.ArgumentParser(
		prog="vmsctl.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
	)
	p.add_argument("-s", "--site", help="frappectl profile (default: $VMS_SITE, then frappectl's default)")
	p.add_argument("--json", action="store_true", help="print JSON instead of text")
	sub = p.add_subparsers(required=True, metavar="command")

	def cmd(name, fn, help_):
		c = sub.add_parser(name, help=help_, description=help_)
		c.add_argument("--json", action="store_true", default=argparse.SUPPRESS, help="print JSON")
		c.set_defaults(run=fn)
		return c

	cmd("projects", r.projects, "list projects").add_argument("query", nargs="?")

	ls = cmd("ls", r.ls, "folders and files in a project or folder")
	ls.add_argument("path")
	ls.add_argument("-r", "--recursive", action="store_true", help="every file below, with relative paths")

	t = cmd("tree", r.tree_cmd, "folder tree with file counts")
	t.add_argument("path"), t.add_argument("-d", "--depth", type=int)

	f = cmd("find", r.find, "find files by name (substring)")
	f.add_argument("text"), f.add_argument("--in", dest="within", help="only inside this project or folder")
	f.add_argument("--limit", type=int, default=50)

	cmd("info", r.info, "details of one file").add_argument("path")

	lk = cmd("link", r.link, "short-lived view links for files or every file in a folder")
	lk.add_argument("paths", nargs="+")
	lk.add_argument("-r", "--recursive", action="store_true")
	lk.add_argument("--download", action="store_true", help="download links instead of streaming links")

	g = cmd("get", r.get, "download files or folders to disk (skips files already there)")
	g.add_argument("paths", nargs="+")
	g.add_argument("-o", "--out", default=".", help="target directory (default: .)")
	g.add_argument("-r", "--recursive", action="store_true")

	cmd("transcript", r.transcript, "print a file's transcript").add_argument("path")

	mk = cmd("mkdir", w.mkdir, "create a folder")
	mk.add_argument("path"), mk.add_argument("-p", "--parents", action="store_true")

	rn = cmd("rename", w.rename, "rename a file or folder")
	rn.add_argument("path"), rn.add_argument("new_name")

	mv = cmd("mv", w.move, "move files or folders into a folder or project root (last argument)")
	mv.add_argument("paths", nargs="+"), mv.add_argument("dest")

	tg = cmd("tag", w.tag, "add tags to a file (or remove with --rm)")
	tg.add_argument("path"), tg.add_argument("tags", nargs="+")
	tg.add_argument("--rm", dest="remove", action="store_true")

	ca = cmd("category", w.category, "set the category (the site lists the valid ones if you get it wrong)")
	ca.add_argument("category"), ca.add_argument("paths", nargs="+")

	sh = cmd("share", w.share, "public link for a project, folder (browse) or file (review)")
	sh.add_argument("path"), sh.add_argument("--off", action="store_true", help="revoke the link")

	up = cmd("upload", w.upload, "upload files or folders (folders keep their structure)")
	up.add_argument("paths", nargs="+")
	up.add_argument("--to", required=True, help="project or folder to upload into")
	up.add_argument("--category", help="default: the site's default")
	up.add_argument("-n", "--dry-run", action="store_true")
	up.add_argument("--force", action="store_true", help="upload even when a file of that name is there")
	return p


if __name__ == "__main__":
	sys.exit(main())
