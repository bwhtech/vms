# vms-skill

A skill that lets a coding agent work with a VMS site from the terminal. It can browse
projects and folders, pull streaming or download links, download whole folders, upload
files and folders, organise them, and share them. It runs over
`frappectl`, needs no VMS source, and installs
nothing on the site.

`SKILL.md` is the procedure the agent follows. `scripts/vmsctl.py` is the tool it runs.
`reference/cli.md` maps each command to its API call.

## Install

**Give this page to your agent and ask it to set the skill up.** You can also do it by hand.

1. Install frappectl: `uv tool install frappectl`
2. Log in to your site (you do this, not the agent):
   ```sh
   frappectl auth login https://your-vms-site --name vms
   ```
   Use an account with the **Video Manager** or **System Manager** role.
3. Link the skill folder into your agent's skills directory, for example:
   ```sh
   ln -s "$PWD/skills/vms-skill" ~/.claude/skills/vms-skill
   ```
4. Ask the agent something like "get me download links for everything in Acme Launch/Raw".

## Tests

```sh
cd skills/vms-skill/scripts && python3 -m unittest tests.test_vmstool
```

The tests use an in-memory fake of the site and need no server.
