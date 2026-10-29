---
"@partrunner-ai/ui": patch
---

Republish UI with its packed shell development dependency resolved to the
shell release that adds the bell sounds. UI runtime code and styles are
unchanged; the shell version bump only changes UI package metadata, and the
release integrity checks reject a published version whose rebuilt tarball no
longer matches.
