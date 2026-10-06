"""Convert the Claude Design dc template (CAE V2.5.1.dc.html) into React TSX view components.

Faithful to the dc-runtime semantics in project/support.js:
  {{ path }}           -> value lookup on the view model (or a loop variable)
  <sc-for list as>     -> list.map
  <sc-if value>        -> truthy conditional
  style-hover="..."    -> generated :hover class with !important declarations
Usage: python3 convert.py <dc.html> <out_dir>
"""
import html.parser, json, re, sys, os

SRC, OUT = sys.argv[1], sys.argv[2]
raw = open(SRC, encoding='utf-8').read()
tpl = raw[raw.index('<x-dc>') + 6: raw.rindex('</x-dc>')]
tpl = re.sub(r'<helmet>.*?</helmet>', '', tpl, flags=re.S)

VOID = {'input', 'meta', 'link', 'br', 'img', 'hr'}
EVENTS = {'onclick': 'onClick', 'onchange': 'onChange', 'oninput': 'onInput', 'ondragstart': 'onDragStart',
          'ondragover': 'onDragOver', 'ondrop': 'onDrop', 'onkeydown': 'onKeyDown'}


class Node:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.children = tag, attrs, []


class P(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root', [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs)
        self.stack[-1].children.append(n)
        if tag not in VOID:
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        assert self.stack[-1].tag == tag, (self.stack[-1].tag, tag, self.getpos())
        self.stack.pop()

    def handle_data(self, d):
        self.stack[-1].children.append(d)

    def handle_comment(self, d):
        self.stack[-1].children.append(('comment', d.strip()))


p = P()
p.feed(tpl)
p.close()
assert len(p.stack) == 1

# ---------- expressions ----------
PATH_RE = re.compile(r'^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\.\d+)*$')


def expr(path, scope):
    path = path.strip()
    assert PATH_RE.match(path), 'unsupported expression: ' + path
    if path in ('true', 'false', 'null'):
        return path
    segs = path.split('.')
    head = segs[0] if segs[0] in scope else 'v.' + segs[0]
    rest = segs[1:]
    if head.startswith('v.'):
        return head + ''.join('?.' + s for s in rest)
    return head + ''.join(('.' if i == 0 else '?.') + s for i, s in enumerate(rest))


def interp(s, scope):
    """Attribute/text with {{ }} → JS expression (string concatenation via template literal)."""
    whole = re.fullmatch(r'\s*\{\{(.+?)\}\}\s*', s, flags=re.S)
    if whole:
        return expr(whole.group(1), scope), True
    if '{{' not in s:
        return json.dumps(s, ensure_ascii=False), False
    parts = re.split(r'\{\{(.+?)\}\}', s, flags=re.S)
    out = ''
    for i, part in enumerate(parts):
        if i % 2:
            out += '${' + expr(part, scope) + ' ?? ""}'
        else:
            out += part.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    return '`' + out + '`', True


# ---------- styles ----------
def camel(prop):
    return prop if prop.startswith('--') else re.sub(r'-([a-z])', lambda m: m.group(1).upper(), prop)


def style_obj(css, scope):
    items = []
    for decl in css.split(';'):
        if ':' not in decl:
            continue
        prop, val = decl.split(':', 1)
        prop, val = prop.strip(), val.strip()
        if '{{' in val:
            js, _ = interp(val, scope)
        else:
            js = json.dumps(val, ensure_ascii=False)
        key = camel(prop)
        items.append((key if re.match(r'^[A-Za-z_$][\w$]*$', key) else json.dumps(key)) + ': ' + js)
    return '{ ' + ', '.join(items) + ' }'


HOVER = {}


def hover_class(css):
    css = ';'.join(d.strip() for d in css.split(';') if d.strip())
    if css not in HOVER:
        abbr = {'background': 'bg', 'border-color': 'border', 'color': 'color'}
        name = 'hover-' + '-'.join(
            abbr.get(d.split(':')[0].strip(), d.split(':')[0].strip()) + '-' + re.sub(r'[^a-z0-9]', '', d.split(':', 1)[1].lower())
            for d in css.split(';'))
        HOVER[css] = name
    return HOVER[css]


def display_of(node):
    if not isinstance(node, Node):
        return None
    st = dict(node.attrs).get('style') or ''
    m = re.search(r'(?:^|;)\s*display\s*:\s*([a-z-]+)', st)
    if m:
        return m.group(1)
    return 'block' if node.tag in ('div',) else 'inline'


def is_block(node):
    if isinstance(node, Node):
        if node.tag in ('sc-for', 'sc-if'):
            els = [c for c in node.children if isinstance(c, Node)]
            return bool(els) and all(is_block(c) for c in els)
        return display_of(node) in ('block', 'flex', 'grid')
    return False


# ---------- emit ----------
SPLIT = {}  # component name -> (jsx, deps)


def esc_text(t):
    if re.search(r'[{}<>&]', t) or t.strip() != t and not t.strip():
        return '{' + json.dumps(t, ensure_ascii=False) + '}'
    return t


def emit_children(children, scope, parent_el, split_names):
    out = []
    kids = list(children)
    pending_name = None
    for idx, c in enumerate(kids):
        if isinstance(c, tuple):
            name = c[1]
            m = re.fullmatch(r'=*\s*([A-Z0-9 /\-&]+?)\s*=*', name)
            out.append('{/* ' + name.strip('= ').title() + ' */}')
            if m and m.group(1).strip() in split_names:
                pending_name = split_names[m.group(1).strip()]
            continue
        if isinstance(c, str):
            out.append(emit_text(c, scope, parent_el, kids, idx))
            continue
        if pending_name and isinstance(c, Node):
            out.append(emit_split(c, scope, pending_name, split_names))
            pending_name = None
            continue
        out.append(emit_node(c, scope, parent_el, split_names))
    return ''.join(o for o in out if o)


def neighbour(kids, idx, step):
    j = idx + step
    while 0 <= j < len(kids):
        if isinstance(kids[j], Node):
            return kids[j]
        if isinstance(kids[j], str) and kids[j].strip():
            return kids[j]
        j += step
    return None


def emit_text(t, scope, parent_el, kids, idx):
    if not t.strip():
        if ' ' not in t:
            return ''
        disp = display_of(parent_el)
        if disp in ('flex', 'inline-flex', 'grid'):
            return ''
        prev, nxt = neighbour(kids, idx, -1), neighbour(kids, idx, 1)
        if prev is None or nxt is None or is_block(prev) or is_block(nxt):
            if parent_el is None or parent_el.tag not in ('span', 'b', 'a'):
                return ''
        return '{" "}'
    t = re.sub(r'\s+', ' ', t)
    if '{{' not in t:
        return esc_text(t)
    parts = re.split(r'\{\{(.+?)\}\}', t, flags=re.S)
    out = ''
    for i, part in enumerate(parts):
        if i % 2:
            out += '{' + expr(part, scope) + '}'
        elif part:
            out += esc_text(part)
    return out


def emit_attrs(node, scope):
    out, classes = [], []
    for name, val in node.attrs:
        val = val if val is not None else ''
        if name.startswith('hint-'):
            continue
        if name == 'style':
            out.append('style={' + style_obj(val, scope) + '}')
            continue
        if name.startswith('style-'):
            pseudo = name[6:]
            assert pseudo == 'hover', pseudo
            classes.append(hover_class(val))
            continue
        key = EVENTS.get(name, name)
        if name.startswith('on'):
            assert name in EVENTS, name
        if key == 'class':
            key = 'className'
        js, dyn = interp(val, scope)
        out.append(key + '=' + ('{' + js + '}' if dyn else js))
    if classes:
        out.append('className="' + ' '.join(classes) + '"')
    return (' ' + ' '.join(out)) if out else ''


def emit_node(node, scope, parent_el, split_names, key=None):
    if node.tag == 'sc-for':
        a = dict(node.attrs)
        lst, _ = interp(a['list'], scope)
        var = a.get('as', 'item')
        inner_scope = scope | {var, '$index'}
        body = emit_children(node.children, inner_scope, parent_el, split_names)
        els = [c for c in node.children if isinstance(c, Node)]
        texts = [c for c in node.children if isinstance(c, str) and c.strip()]
        uses_index = '$index' in body
        idx = '$index' if uses_index else ('idx' if var == 'i' else 'i')
        if len(els) == 1 and not texts and els[0].tag not in ('sc-if', 'sc-for'):
            body = emit_node(els[0], inner_scope, parent_el, split_names, key=idx)
            return '{' + lst + '?.map((' + var + ', ' + idx + ') => (' + body + '))}'
        return '{' + lst + '?.map((' + var + ', ' + idx + ') => (<Fragment key={' + idx + '}>' + body + '</Fragment>))}'
    if node.tag == 'sc-if':
        cond, _ = interp(dict(node.attrs)['value'], scope)
        body = emit_children(node.children, scope, parent_el, split_names)
        els = [c for c in node.children if isinstance(c, Node)]
        texts = [c for c in node.children if isinstance(c, str) and c.strip()]
        if len(els) == 1 and not texts and els[0].tag not in ('sc-if', 'sc-for'):
            body = emit_node(els[0], scope, parent_el, split_names)
        else:
            body = '<>' + body + '</>'
        if key is not None:
            body = '<Fragment key={' + key + '}>' + body + '</Fragment>'
        return '{' + cond + ' ? (' + body + ') : null}'
    attrs = emit_attrs(node, scope)
    if key is not None:
        attrs = ' key={' + key + '}' + attrs
    if node.tag == 'textarea':
        assert not [c for c in node.children if isinstance(c, Node) or (isinstance(c, str) and c.strip())]
        return '<textarea' + attrs + ' />'
    if node.tag in VOID or not node.children:
        return '<' + node.tag + attrs + ' />'
    return '<' + node.tag + attrs + '>' + emit_children(node.children, scope, node, split_names) + '</' + node.tag + '>'


def emit_split(node, scope, name, split_names):
    """Hoist a commented section into its own component. sc-if wrappers stay in the parent."""
    assert scope == set(), 'cannot split inside a loop: ' + name
    if node.tag == 'sc-if':
        cond, _ = interp(dict(node.attrs)['value'], scope)
        SPLIT[name] = '<>' + emit_children(node.children, scope, None, split_names) + '</>'
        return '{' + cond + ' ? <' + name + ' v={v} /> : null}'
    SPLIT[name] = emit_node(node, scope, None, split_names)
    return '<' + name + ' v={v} />'


# Section comment in the design -> component name.
SPLIT_NAMES = {
    'SIDEBAR': 'Sidebar', 'TOPBAR': 'Topbar',
    'DASHBOARD': 'DashboardView', 'PRIORITY QUEUE': 'QueueView', 'CAMPAIGNS': 'CampaignsView',
    'PROSPECTS LIST': 'ProspectsView', 'PROSPECT DETAIL': 'ProspectDetailView',
    'RESEARCH': 'DetailResearch', 'OPPORTUNITY': 'DetailOpportunity', 'FOLLOW-UP / RESPONSE': 'DetailFollowUp',
    'DISCOVERY': 'DetailDiscovery', 'PROPOSAL': 'DetailProposal', 'OUTCOME': 'DetailOutcome',
    'OPPORTUNITIES': 'OpportunitiesView', 'OUTREACH': 'OutreachView', 'PIPELINE': 'PipelineView',
    'CLIENTS': 'ClientsView', 'TASKS': 'TasksView', 'ANALYTICS': 'AnalyticsView', 'TEMPLATES': 'TemplatesView',
    'SETTINGS': 'SettingsView',
    'RECORD RESPONSE': 'RecordResponseModal', 'CLOSE WON / LOST': 'CloseOutcomeModal',
    'ACQUISITION SCORE BREAKDOWN': 'ScoreBreakdownModal', 'MESSAGE GENERATOR': 'MessageGeneratorModal',
    'ADD PROSPECT MODAL': 'AddProspectModal', 'OPPORTUNITY BRIEF MODAL': 'OpportunityBriefModal',
}

root_jsx = emit_children(p.root.children, set(), None, SPLIT_NAMES)
os.makedirs(OUT, exist_ok=True)

HEADER = '// Markup ported 1:1 from project/CAE V2.5.1.dc.html (initially generated by scripts/convert-design.py).\n'


def component_file(name, jsx, children):
    imports = ['import type { VM } from "../vm";']
    if 'Fragment' in jsx:
        imports.insert(0, 'import { Fragment } from "react";')
    for ch in sorted(children):
        imports.append('import ' + ch + ' from "./' + ch + '";')
    return (HEADER + '\n'.join(imports) + '\n\nexport default function ' + name + '({ v }: { v: VM }) {\n  return (' + jsx + ');\n}\n')


def refs(jsx):
    return {n for n in SPLIT if re.search(r'<' + n + r' v=\{v\} />', jsx)}


for name, jsx in SPLIT.items():
    open(os.path.join(OUT, name + '.tsx'), 'w', encoding='utf-8').write(component_file(name, jsx, refs(jsx)))
open(os.path.join(OUT, 'Layout.tsx'), 'w', encoding='utf-8').write(component_file('Layout', '<>' + root_jsx + '</>', refs(root_jsx)))

css = '/* Hover states from the design\'s style-hover attributes (dc-runtime applies them with !important). */\n'
for decls, cls in sorted(HOVER.items(), key=lambda kv: kv[1]):
    body = ';'.join(d.strip() + ' !important' for d in decls.split(';'))
    css += '.' + cls + ':hover{' + body + '}\n'
open(os.path.join(OUT, '..', 'styles', 'hover.css'), 'w', encoding='utf-8').write(css)
print('components:', len(SPLIT) + 1, 'hover classes:', len(HOVER))
