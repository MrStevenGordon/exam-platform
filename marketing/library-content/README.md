# Starter books for the Library (prepared, NOT uploaded)

Three Shakespeare plays, each with a text PDF and an audio recording by act. These are the CSEC English B drama set texts in the three cycles on the CXC syllabus (revised 2025): *Twelfth Night* (to January 2028), *Macbeth* (June 2028 to January 2033), *A Midsummer Night's Dream* (June 2033 to January 2038).

| | Where it came from | Licence |
|---|---|---|
| Text | Standard Ebooks, rebuilt as a book-sized PDF (`pdf/`) | Shakespeare died in 1616 (public domain anywhere). The edition is CC0. |
| Audio | LibriVox volunteer recordings, one file per act (`audio/`) | LibriVox recordings are dedicated to the public domain (CC0). |

Everything about each book (title, description, levels, licence, source, credit and the file list) is in `catalog-ready.json`, in the same fields the owner's Library catalog form uses. `rights_confirmed` is left **false**: ticking that box is your decision.

Before publishing:
- Listen to some of each audio recording. They are volunteer, multi-reader recordings, and quality varies.
- Skim a few PDF pages against the edition your students use (line numbers and notes can differ from a school edition).
- Tick the rights box only when you are satisfied.

Rebuild a PDF: `python3 epub_to_pdf.py <slug>` (needs the EPUB in this folder and Google Chrome).
