"""Generates concept screens for the Smart Learning Library, in the product's own look (product.css is the real globals.css).
Sample titles and data only. Run: python3 build_mockups.py"""
import os, html

OUT = os.path.join(os.path.dirname(__file__), 'screens')

# ---------- shared pieces ----------
EXTRA_CSS = """
body{margin:0}
.concept-tag{position:fixed;bottom:12px;right:14px;z-index:50;background:#1E1208;color:#FAC882;font-size:11px;font-weight:700;letter-spacing:1px;padding:5px 10px;border-radius:100px;text-transform:uppercase}
.side{width:200px;background:#1A0E06;min-height:100vh;display:flex;flex-direction:column;flex-shrink:0;position:sticky;top:0;height:100vh}
.side .brand{padding:20px 20px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
.nav-i{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:6px;font-size:13px;color:rgba(255,255,255,.55);border-left:3px solid transparent;margin:1px 0}
.nav-i.on{background:rgba(212,118,42,.25);color:#FAC882;font-weight:600;border-left-color:#D4762A}
.nav-i .ti{font-size:16px}
.cover{border-radius:4px;display:flex;flex-direction:column;justify-content:space-between;padding:10px;box-sizing:border-box;position:relative;box-shadow:0 2px 6px rgba(80,40,10,.25)}
.cover .t{font-family:'Fraunces',serif;font-weight:600;line-height:1.1}
.cover .a{font-size:9px;letter-spacing:1px;text-transform:uppercase;opacity:.85;font-weight:600}
.bk{width:150px;flex-shrink:0}
.bk .meta{margin-top:8px}
.bk .ti1{font-size:13px;font-weight:600;line-height:1.25;color:var(--text-primary)}
.bk .au{font-size:12px;color:var(--text-secondary);margin-top:2px}
.fmt{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--text-secondary);background:#fff;border:1px solid var(--border);border-radius:100px;padding:2px 8px;margin-right:4px}
.fmt .ti{font-size:12px}
.shelf{display:flex;gap:18px;overflow:hidden}
.shelf-h{display:flex;align-items:baseline;justify-content:space-between;margin:26px 0 12px}
.shelf-h h2{margin:0;font-size:17px;font-weight:700}
.shelf-h span{font-size:12px;color:var(--accent-dark);font-weight:600}
.chipbar{display:flex;gap:8px;flex-wrap:wrap}
.chip{font-size:12px;font-weight:600;padding:6px 12px;border-radius:100px;border:1px solid var(--border-strong);background:#fff;color:var(--text-secondary)}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.prog{height:5px;border-radius:3px;background:var(--border);overflow:hidden}
.prog>i{display:block;height:100%;background:var(--accent)}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin:18px 0 4px}
.tab{padding:9px 14px;font-size:13px;font-weight:600;color:var(--text-muted);border-bottom:2px solid transparent;margin-bottom:-1px}
.tab.on{color:var(--accent-dark);border-bottom-color:var(--accent)}
.lic{font-size:11px;color:var(--text-secondary)}
.lic b{color:var(--success)}
table.t{width:100%;border-collapse:collapse;font-size:13px}
table.t th{text-align:left;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--text-muted);padding:8px 10px;border-bottom:1px solid var(--border)}
table.t td{padding:10px;border-bottom:1px solid var(--border);vertical-align:middle}
.field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.field label{font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px}
.field .in{border:1px solid var(--border-strong);border-radius:8px;padding:9px 12px;font-size:13px;background:#fff;color:var(--text-primary)}
.tog{width:38px;height:22px;border-radius:100px;background:var(--border-strong);position:relative;flex-shrink:0}
.tog.on{background:var(--success)}
.tog::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff}
.tog.on::after{left:19px}
"""

HEAD = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><link rel="stylesheet" href="product.css"><style>{css}</style></head><body>"""

def cover(title, author, bg, fg, w, h, tsize=15):
    return f'<div class="cover" style="width:{w}px;height:{h}px;background:{bg};color:{fg}"><div class="a">{author}</div><div class="t" style="font-size:{tsize}px">{title}</div></div>'

def shell(portal, role_line, user, items, active, content, tag='Concept screen'):
    nav = ''.join(f'<div class="nav-i{" on" if it[0]==active else ""}"><i class="ti {it[1]}"></i><span style="flex:1">{it[0]}</span>{("<span style=background:#D4762A;color:#fff;font-size:9px;font-weight:700;border-radius:100px;padding:2px 6px>NEW</span>" if it[0]=="Library" else "")}</div>' for it in items)
    ini = ''.join(w[0] for w in user.split()[:2])
    return f"""<div class="concept-tag">{tag}</div><div class="portal-layout"><aside class="side">
<div class="brand"><div style="font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase">Smart Assess Ja</div><div style="font-size:15px;font-weight:700;color:#fff;margin-top:2px">{portal}</div></div>
<nav style="flex:1;padding:12px 10px">{nav}</nav>
<div style="padding:12px 14px;border-top:1px solid rgba(255,255,255,.08)"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:34px;height:34px;border-radius:50%;background:rgba(212,118,42,.3);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#FAC882">{ini}</div><div><div style="font-size:13px;font-weight:600;color:#fff">{user}</div><div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-top:1px">{role_line}</div></div></div>
<div style="padding:7px 12px;font-size:12px;font-weight:600;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:rgba(255,255,255,.6);text-align:center">Log out</div></div></aside>
<main class="portal-content">{content}</main></div>"""

def page(name, title, body, css=''):
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(HEAD.format(title=html.escape(title), css=EXTRA_CSS + css) + body + '</body></html>')

STUDENT_NAV = [('My lessons', 'ti-school'), ('Library', 'ti-books')]
TEACHER_NAV = [('My lessons', 'ti-school'), ('New lesson', 'ti-square-plus'), ('Lesson plans', 'ti-notebook'), ('Library', 'ti-books')]
INK, COP, TEAL, BRN, GOLD, RUST, SAGE = '#1E1208', '#D4762A', '#1F8A84', '#6B4F35', '#F2C230', '#A85A18', '#3F6B4F'

def bk(title, author, bg, fg, fmts=('read',), prog=None, lic=None, size=(150, 210)):
    f = ''.join(f'<span class="fmt"><i class="ti {"ti-book-2" if x=="read" else "ti-headphones"}"></i>{"Read" if x=="read" else "Listen"}</span>' for x in fmts)
    p = f'<div class="prog" style="margin-top:8px"><i style="width:{prog}%"></i></div><div style="font-size:11px;color:var(--text-muted);margin-top:3px">{prog}% done</div>' if prog is not None else ''
    l = f'<div class="lic" style="margin-top:5px">{lic}</div>' if lic else ''
    return f'<div class="bk">{cover(title, author, bg, fg, size[0], size[1])}<div class="meta"><div class="ti1">{title}</div><div class="au">{author}</div><div style="margin-top:6px">{f}</div>{p}{l}</div></div>'

PD = '<b>Public domain</b>'
CC = '<b>Open licence</b> (CC BY)'

# ---------- 1. Student: Library home ----------
c = f"""
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
  <div><h1 class="portal-page-title">Library</h1><div style="font-size:13px;color:var(--text-secondary)">Read it. Listen to it. Pick up where you left off.</div></div>
  <div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border-strong);background:#fff;border-radius:100px;padding:8px 14px;width:280px;font-size:13px;color:var(--text-muted)"><i class="ti ti-search"></i>Search books, authors, topics</div>
</div>
<div class="tabs"><div class="tab on">All</div><div class="tab">Curriculum</div><div class="tab">Read for fun</div><div class="tab">Saved for offline <span class="badge badge-default" style="margin-left:4px">3</span></div></div>
<div class="shelf-h"><h2>Continue</h2></div>
<div class="shelf">{bk('Macbeth','William Shakespeare',INK,'#FAC882',('read','listen'),prog=34,lic='Assigned: Act 2, due Fri 16 Oct')}{bk('Treasure Island','R. L. Stevenson',TEAL,'#fff',('read','listen'),prog=61,lic='Listening, 3h 20m left')}{bk('Chemistry 2e','OpenStax',RUST,'#fff',('read',),prog=12,lic='Chapter 4 assigned')}</div>
<div class="shelf-h"><h2>Curriculum</h2><span>See all</span></div>
<div class="chipbar" style="margin-bottom:14px"><span class="chip on">English</span><span class="chip">Mathematics</span><span class="chip">Science</span><span class="chip">Social Studies</span><span class="chip">Literature</span></div>
<div class="shelf">{bk('Macbeth','William Shakespeare',INK,'#FAC882',('read','listen'),lic=PD)}{bk('Jamaican Song and Story','Walter Jekyll',BRN,'#F6EDE0',('read',),lic=PD)}{bk('Songs of Jamaica','Claude McKay',SAGE,'#fff',('read',),lic=PD)}{bk('Prealgebra 2e','OpenStax',COP,'#fff',('read',),lic=CC)}{bk('Chemistry 2e','OpenStax',RUST,'#fff',('read',),lic=CC)}</div>
<div class="shelf-h"><h2>Read for fun</h2><span>See all</span></div>
<div class="shelf">{bk('Treasure Island','R. L. Stevenson',TEAL,'#fff',('read','listen'),lic=PD)}{bk('The Jungle Book','Rudyard Kipling',SAGE,'#fff',('read','listen'),lic=PD)}{bk('Tom Sawyer','Mark Twain',GOLD,INK,('read','listen'),lic=PD)}{bk('Anansi Stories','Collected folk tales',COP,'#fff',('read','listen'),lic=PD)}{bk('Pride and Prejudice','Jane Austen',BRN,'#F6EDE0',('read','listen'),lic=PD)}</div>
<div style="font-size:11px;color:var(--text-muted);margin-top:22px">Sample titles for the concept. Availability and licences are checked before any title is published.</div>
"""
page('1-student-library.html', 'Student Library', shell('Smart Learning', 'Student · Form 4', 'Demo Student', STUDENT_NAV, 'Library', c))

# ---------- 2. Student: book detail ----------
c = f"""
<div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px"><i class="ti ti-arrow-left"></i> Library</div>
<div style="display:flex;gap:32px;align-items:flex-start;max-width:980px">
  <div>{cover('Macbeth','William Shakespeare',INK,'#FAC882',230,330,26)}<div class="lic" style="margin-top:10px;text-align:center">{PD}</div></div>
  <div style="flex:1">
    <h1 class="portal-page-title" style="font-size:30px;text-transform:none">Macbeth</h1>
    <div style="font-size:15px;color:var(--text-secondary);margin-bottom:12px">William Shakespeare</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px"><span class="badge badge-default">English Literature</span><span class="badge badge-default">Forms 4 to 5</span><span class="badge badge-default">Drama</span><span class="badge badge-default">Topic: Tragedy</span></div>
    <div class="banner banner-warning" style="margin-bottom:16px;display:flex;gap:10px;align-items:center"><i class="ti ti-bookmark"></i><div><b>Assigned by Ms Reid:</b> read Act 2. Due Fri 16 Oct.</div></div>
    <div style="display:flex;gap:10px;margin-bottom:12px"><span class="btn btn-primary"><i class="ti ti-book-2"></i> Continue reading, page 18</span><span class="btn btn-secondary"><i class="ti ti-headphones"></i> Listen, 3h 12m</span><span class="btn btn-ghost"><i class="ti ti-download"></i> Save offline</span></div>
    <div class="prog" style="max-width:420px"><i style="width:34%"></i></div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">34% read · last opened yesterday</div>
    <p style="font-size:14px;line-height:1.6;color:var(--text-secondary);max-width:560px;margin:18px 0">A Scottish general is told he will become king. How far will he go to make it true? A short, fast tragedy about ambition, guilt and consequences.</p>
    <div class="card" style="padding:0;max-width:560px">
      <div style="padding:12px 16px;font-weight:700;font-size:14px;border-bottom:1px solid var(--border)">Contents</div>
      <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px"><span><i class="ti ti-circle-check" style="color:var(--success)"></i>&nbsp; Act 1</span><span style="color:var(--text-muted)">Done</span></div>
      <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px;background:var(--accent-light)"><span><i class="ti ti-player-play" style="color:var(--accent)"></i>&nbsp; <b>Act 2</b> &nbsp;<span class="badge badge-warning">Assigned</span></span><span style="color:var(--text-muted)">In progress</span></div>
      <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px"><span><i class="ti ti-circle"></i>&nbsp; Act 3</span><span style="color:var(--text-muted)">Not started</span></div>
    </div>
    <div class="lic" style="margin-top:14px;max-width:560px">About this edition: public-domain text and a volunteer audio recording. Source and licence are shown for every book.</div>
  </div>
</div>"""
page('2-book-detail.html', 'Book detail', shell('Smart Learning', 'Student · Form 4', 'Demo Student', STUDENT_NAV, 'Library', c))

# ---------- 3. Student: reader ----------
lines = """<p><i>Scene I. A desert place. Thunder and lightning.</i></p>
<p><b>First Witch.</b> When shall we three meet again<br>In thunder, lightning, or in rain?</p>
<p><b>Second Witch.</b> When the hurlyburly's done,<br>When the battle's lost and won.</p>
<p><b>Third Witch.</b> That will be ere the set of sun.</p>
<p><b>First Witch.</b> Where the place?</p>
<p><b>Second Witch.</b> Upon the heath.</p>"""
c = f"""
<div style="display:flex;align-items:center;gap:14px;padding:10px 0 14px;border-bottom:1px solid var(--border)">
  <span class="btn btn-ghost"><i class="ti ti-arrow-left"></i> Back</span>
  <div style="flex:1"><div style="font-weight:700;font-size:15px">Macbeth</div><div style="font-size:12px;color:var(--text-muted)">Act 2 · page 18 of 52</div></div>
  <span class="btn btn-secondary"><i class="ti ti-letter-case"></i> A- &nbsp; A+</span><span class="btn btn-secondary"><i class="ti ti-bookmark"></i> Bookmark</span><span class="btn btn-secondary"><i class="ti ti-note"></i> Note</span><span class="btn btn-primary"><i class="ti ti-headphones"></i> Listen from here</span>
</div>
<div style="display:flex;gap:24px;margin-top:20px;align-items:flex-start">
  <div class="card" style="flex:1;max-width:720px;margin:0 auto;padding:46px 56px;font-family:'Fraunces',serif;font-size:19px;line-height:1.7;color:var(--text-primary);min-height:520px">{lines}</div>
  <div style="width:260px;flex-shrink:0">
    <div class="card" style="padding:14px 16px;margin-bottom:12px"><div class="section-label">Contents</div><div style="font-size:13px;line-height:2"><div>Act 1</div><div style="color:var(--accent-dark);font-weight:700">Act 2</div><div>Act 3</div></div></div>
    <div class="card" style="padding:14px 16px"><div class="section-label">Bookmarks and notes</div><div style="font-size:13px;color:var(--text-secondary)"><div style="margin-bottom:8px"><i class="ti ti-bookmark" style="color:var(--accent)"></i> Page 4</div><div><i class="ti ti-note" style="color:var(--accent)"></i> "Why does she hurry him?" (page 11)</div></div></div>
  </div>
</div>
<div style="max-width:720px;margin:14px auto 0"><div class="prog"><i style="width:34%"></i></div></div>"""
page('3-reader.html', 'Reader', shell('Smart Learning', 'Student · Form 4', 'Demo Student', STUDENT_NAV, 'Library', c))

# ---------- 4. Student: audio player (mobile) ----------
mobile = f"""
<div style="width:390px;min-height:844px;background:#FDF8F3;margin:0 auto;display:flex;flex-direction:column;position:relative">
  <div style="background:#1A0E06;padding:14px 16px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase">Smart Assess Ja</div><div style="font-size:14px;font-weight:700;color:#fff">Library</div></div><i class="ti ti-menu-2" style="color:#fff;font-size:20px"></i></div>
  <div style="padding:22px 24px 8px;text-align:center">
    <div style="display:flex;justify-content:center">{cover('Treasure Island','R. L. Stevenson',TEAL,'#fff',210,290,22)}</div>
    <div style="font-size:18px;font-weight:700;margin-top:18px">Treasure Island</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">Chapter 12: What I Heard in the Apple Barrel</div>
    <div style="margin-top:8px"><span class="badge badge-success"><i class="ti ti-download"></i> Saved for offline</span></div>
  </div>
  <div style="padding:6px 28px"><div class="prog" style="height:6px"><i style="width:36%"></i></div><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-top:6px"><span>12:40</span><span>-21:32</span></div></div>
  <div style="display:flex;justify-content:center;align-items:center;gap:26px;margin:8px 0 14px">
    <i class="ti ti-rewind-backward-15" style="font-size:32px;color:var(--text-secondary)"></i>
    <div style="width:68px;height:68px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center"><i class="ti ti-player-pause" style="font-size:30px;color:#fff"></i></div>
    <i class="ti ti-rewind-forward-15" style="font-size:32px;color:var(--text-secondary)"></i>
  </div>
  <div style="display:flex;justify-content:center;gap:10px;margin-bottom:16px"><span class="chip">1.0x speed</span><span class="chip"><i class="ti ti-moon"></i> Sleep timer</span><span class="chip"><i class="ti ti-book-2"></i> Read along</span></div>
  <div style="padding:0 20px"><div class="card" style="padding:0">
    <div style="padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border)">Chapters</div>
    <div style="padding:9px 14px;font-size:13px;color:var(--text-muted)"><i class="ti ti-circle-check" style="color:var(--success)"></i>&nbsp; 11. The Captain's Papers</div>
    <div style="padding:9px 14px;font-size:13px;background:var(--accent-light);font-weight:600"><i class="ti ti-player-play" style="color:var(--accent)"></i>&nbsp; 12. What I Heard in the Apple Barrel</div>
    <div style="padding:9px 14px;font-size:13px">&nbsp;&nbsp;&nbsp;&nbsp; 13. Council of War</div>
  </div></div>
  <div style="font-size:11px;color:var(--text-muted);text-align:center;margin:16px 0 8px">Public-domain text with a volunteer recording</div>
</div>"""
page('4-audio-player-mobile.html', 'Audio player', '<div class="concept-tag">Concept screen</div>' + mobile, css='body{background:#e9e2d8}')

# ---------- 5. Teacher: assign reading ----------
c = f"""
<h1 class="portal-page-title">Assign reading</h1>
<div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">Choose a book, a class and a date. Students find it in their Library.</div>
<div style="display:flex;gap:28px;align-items:flex-start;max-width:1060px">
  <div style="flex:1">
    <div class="card" style="padding:22px">
      <div class="field"><label>Book</label><div class="in" style="display:flex;justify-content:space-between"><span>Macbeth · William Shakespeare</span><i class="ti ti-chevron-down"></i></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="field"><label>From</label><div class="in">Act 2, Scene 1</div></div><div class="field"><label>To</label><div class="in">Act 2, Scene 4</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="field"><label>Class</label><div class="in">Form 4-2 English</div></div><div class="field"><label>Due</label><div class="in">Fri 16 Oct 2026</div></div></div>
      <div class="field"><label>Students can</label><div style="display:flex;gap:8px"><span class="chip on"><i class="ti ti-book-2"></i> Read</span><span class="chip on"><i class="ti ti-headphones"></i> Listen</span></div></div>
      <div class="field"><label>Note to students</label><div class="in" style="min-height:60px">Focus on how Lady Macbeth persuades him. We will discuss it on Monday.</div></div>
      <div class="field"><label>Check your understanding (optional)</label><div class="in" style="display:flex;justify-content:space-between;color:var(--text-secondary)"><span><i class="ti ti-list-check"></i> 3 questions attached</span><span style="color:var(--accent-dark);font-weight:700">Edit</span></div></div>
      <div style="display:flex;gap:10px;margin-top:6px"><span class="btn btn-primary">Assign to class</span><span class="btn btn-ghost">Cancel</span></div>
    </div>
  </div>
  <div style="width:280px;flex-shrink:0"><div class="card" style="padding:18px;text-align:center">{cover('Macbeth','William Shakespeare',INK,'#FAC882',160,230,20)}<div style="font-weight:700;margin-top:12px">Macbeth</div><div class="lic" style="margin-top:4px">{PD}</div><div style="font-size:12px;color:var(--text-secondary);margin-top:10px">Linked topic: Tragedy<br>Reading time: about 45 minutes</div></div></div>
</div>"""
page('5-teacher-assign.html', 'Assign reading', shell('Smart Learning', 'Teacher · English', 'Ms Reid', TEACHER_NAV, 'Library', c))

# ---------- 6. Teacher: class reading progress ----------
rows = [('Student A','Done',100,'Listened','52 min','Today'),('Student B','Reading',70,'Read','38 min','Today'),('Student C','Reading',45,'Listened','25 min','Yesterday'),('Student D','Done',100,'Read','47 min','Yesterday'),('Student E','Not started',0,'-','-','-'),('Student F','Reading',20,'Read','12 min','2 days ago'),('Student G','Not started',0,'-','-','-'),('Student H','Done',100,'Read and listened','61 min','Today')]
badge = {'Done':'badge-success','Reading':'badge-warning','Not started':'badge-default'}
trs = ''.join(f'<tr><td style="font-weight:600">{n}</td><td><span class="badge {badge[s]}">{s}</span></td><td style="width:200px"><div class="prog"><i style="width:{p}%"></i></div></td><td>{f}</td><td>{t}</td><td style="color:var(--text-muted)">{l}</td></tr>' for n,s,p,f,t,l in rows)
c = f"""
<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1 class="portal-page-title">Reading progress</h1><div style="font-size:13px;color:var(--text-secondary)">Macbeth, Act 2 · Form 4-2 English · Due Fri 16 Oct</div></div><span class="btn btn-secondary"><i class="ti ti-bell"></i> Remind unfinished</span></div>
<div class="stat-grid" style="margin-top:20px;max-width:760px"><div class="stat-card"><div class="stat-card-value">24</div><div class="stat-card-label">Assigned</div></div><div class="stat-card stat-card-accent"><div class="stat-card-value">17</div><div class="stat-card-label">Started</div></div><div class="stat-card stat-card-success"><div class="stat-card-value">9</div><div class="stat-card-label">Finished</div></div><div class="stat-card stat-card-danger"><div class="stat-card-value">7</div><div class="stat-card-label">Not started</div></div></div>
<div class="card" style="padding:6px 8px;max-width:980px"><table class="t"><thead><tr><th>Student</th><th>Status</th><th>Progress</th><th>Format</th><th>Time</th><th>Last opened</th></tr></thead><tbody>{trs}</tbody></table></div>
<div style="font-size:11px;color:var(--text-muted);margin-top:14px">Sample names and figures. Only the class teacher and the department head can see this.</div>"""
page('6-teacher-progress.html', 'Reading progress', shell('Smart Learning', 'Teacher · English', 'Ms Reid', TEACHER_NAV, 'Library', c))

# ---------- 7. Central curator: catalog ----------
rows = [('Macbeth','Shakespeare','Public domain','Read, Listen','English Literature','Curriculum','Forms 4-5','Published'),('Jamaican Song and Story','Walter Jekyll','Public domain','Read','Literature','Curriculum','Forms 1-5','Published'),('Chemistry 2e','OpenStax','CC BY 4.0','Read','Science','Curriculum','Forms 4-5','Published'),('Treasure Island','R. L. Stevenson','Public domain','Read, Listen','Fiction','Read for fun','Forms 1-3','Published'),('Anansi Stories','Collected','Public domain','Read, Listen','Folk tales','Read for fun','Forms 1-2','Needs review'),('New title','-','Not set','Read','-','-','-','Draft')]
st = {'Published':'badge-success','Needs review':'badge-warning','Draft':'badge-default'}
trs = ''.join(f'<tr><td style="font-weight:600">{a}<div style="font-weight:400;font-size:11px;color:var(--text-muted)">{b}</div></td><td>{c_}</td><td>{d}</td><td>{e}</td><td>{f}</td><td>{g}</td><td><span class="badge {st[h]}">{h}</span></td></tr>' for a,b,c_,d,e,f,g,h in rows)
OWNER_NAV = [('Schools','ti-building'),('School requests','ti-inbox'),('School features','ti-adjustments'),('Library catalog','ti-books')]
c = f"""
<div style="display:flex;justify-content:space-between"><div><h1 class="portal-page-title">Library catalog</h1><div style="font-size:13px;color:var(--text-secondary)">Curated centrally. Schools switch shelves on or off.</div></div><span class="btn btn-primary"><i class="ti ti-plus"></i> Add a book</span></div>
<div style="display:flex;gap:24px;margin-top:20px;align-items:flex-start">
 <div class="card" style="flex:1;padding:6px 8px"><table class="t"><thead><tr><th>Title</th><th>Licence</th><th>Formats</th><th>Subject</th><th>Shelf</th><th>Age band</th><th>Status</th></tr></thead><tbody>{trs}</tbody></table></div>
 <div class="card" style="width:340px;flex-shrink:0;padding:20px">
  <div style="font-weight:700;font-size:15px;margin-bottom:14px">Add a book</div>
  <div class="field"><label>Files</label><div class="in" style="border-style:dashed;text-align:center;color:var(--text-muted)"><i class="ti ti-upload"></i> PDF or EPUB, and audio</div></div>
  <div class="field"><label>Licence</label><div class="in" style="display:flex;justify-content:space-between"><span>Public domain</span><i class="ti ti-chevron-down"></i></div></div>
  <div class="field"><label>Source and attribution</label><div class="in" style="color:var(--text-muted)">Where it came from, and credit text</div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label>Shelf</label><div class="in">Curriculum</div></div><div class="field"><label>Age band</label><div class="in">Forms 4-5</div></div></div>
  <div class="field"><label>Subject and topic</label><div class="in">English Literature · Tragedy</div></div>
  <div class="banner banner-warning" style="display:flex;gap:8px;align-items:flex-start;font-size:12px"><i class="ti ti-square-check"></i><span>I have checked that this title may be shared digitally with students.</span></div>
  <div style="display:flex;gap:8px;margin-top:12px"><span class="btn btn-primary">Publish</span><span class="btn btn-ghost">Save draft</span></div>
 </div>
</div>"""
page('7-curator-catalog.html', 'Library catalog', shell('Owner Console', 'Platform owner', 'Platform Owner', OWNER_NAV, 'Library catalog', c, tag='Concept screen'))

# ---------- 8. School admin: shelves ----------
ADMIN_NAV = [('Home','ti-home'),('Students','ti-school'),('Staff','ti-users'),('Timetable','ti-calendar'),('Substitution','ti-replace'),('Library','ti-books')]
def row(t, d, on=True): return f'<div style="display:flex;justify-content:space-between;align-items:center;gap:20px;padding:16px 0;border-bottom:1px solid var(--border)"><div><div style="font-weight:600;font-size:14px">{t}</div><div style="font-size:12px;color:var(--text-secondary);margin-top:3px">{d}</div></div><div class="tog{" on" if on else ""}"></div></div>'
c = f"""
<h1 class="portal-page-title">Library settings</h1>
<div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">Choose what your students see. You can change this at any time.</div>
<div class="card" style="padding:6px 22px;max-width:760px">
 {row('Curriculum shelf','Subject books and readers, organised by subject and topic.')}
 {row('Read for fun shelf','A curated set of stories and classics students can choose for themselves.')}
 {row('Audio books','Students can listen as well as read.')}
 {row('Offline downloads','Students can save books to read or listen without a connection.')}
 {row('Teachers can assign reading','Teachers and department heads can set reading to classes and see progress.')}
 <div style="padding:16px 0"><div style="font-weight:600;font-size:14px">Age bands shown</div><div style="display:flex;gap:8px;margin-top:10px"><span class="chip on">Forms 1 to 3</span><span class="chip on">Forms 4 to 5</span><span class="chip">Sixth form</span></div></div>
</div>
<div style="font-size:11px;color:var(--text-muted);margin-top:14px">New titles are added centrally by Smart Assess Ja. Your school can hide any title you do not want.</div>"""
page('8-school-settings.html', 'Library settings', shell('School Admin', 'School Admin', 'Admin User', ADMIN_NAV, 'Library', c))
print('wrote', len(os.listdir(OUT)) - 2, 'pages')
