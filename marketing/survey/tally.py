# Counts every option per question and writes tallies.json (read by ../presentation/build_report.js).
# Source: handwritten paper surveys at Manchester High School, read from /Volumes/SEC II/HPSCANS/student.pdf and teacher.pdf.
# Every tick counts as a response; the "select up to N" limits printed on the forms are NOT applied.
import json
from collections import Counter
import data_students as DS, data_teachers as DT
def tally(D, qs):
    out = {}
    for q in qs:
        c = Counter(o for v in D.values() for o in v[q])
        out[q] = c.most_common()
    return out
json.dump({'students': {'n': len(DS.S), 'q': tally(DS.S, ['q1','q2','q3','q4','q5'])},
           'teachers': {'n': len(DT.T), 'q': tally(DT.T, ['q1','q2','q3','q4','q5','q6'])}},
          open('tallies.json', 'w'), indent=1)
print('wrote tallies.json')
