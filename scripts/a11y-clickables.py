"""Give clickable <div>/<span> elements in the ported views button semantics (role, tabIndex, keyboard)."""
import re, sys, pathlib
TAG = re.compile(r'<(div|span)\b((?:[^<>{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*)>', re.S)
for path in sys.argv[1:]:
    p = pathlib.Path(path); s = p.read_text()
    n = 0
    def fix(m):
        global n
        attrs = m.group(2)
        if 'onClick=' not in attrs or 'role=' in attrs:
            return m.group(0)
        n += 1
        selfclose = attrs.rstrip().endswith('/')
        body = attrs.rstrip()[:-1] if selfclose else attrs
        return '<' + m.group(1) + body.rstrip() + ' role="button" tabIndex={0} onKeyDown={activate}' + (' /' if selfclose else '') + '>'
    s2 = TAG.sub(fix, s)
    if n:
        if 'activate' not in s.split('export default')[0]:
            s2 = s2.replace('import type { VM } from "../vm";', 'import type { VM } from "../vm";\nimport { activate } from "./ui";', 1)
        p.write_text(s2)
    print(p.name, n)
