# Session guides (Manchester presentation day)

One personalised A4 guide per person (19 people) (6 pages: ice breaker, questions, Smart Assess, Smart Learning, Smart Play, sign in).

- `All-19-guides-print.pdf`: every guide in order. Print double-sided, flip on the long edge; each guide is exactly 6 pages, so guides never share a sheet.
- `pdf/`: one PDF per person. `word/`: the editable Word versions.
- Rebuild: `node ../build_guides.js` (names, roles, text and the first-time password are at the top of that file), then
  `soffice --headless --convert-to pdf --outdir pdf word/*.docx` and `pdfunite pdf/*.pdf All-19-guides-print.pdf`.

The sign-in page prints the shared first-time staff password. The site forces a new password at first sign-in, but collect or shred the printed copies afterwards.
