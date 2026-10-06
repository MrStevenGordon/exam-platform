# Self-hosted fonts

| File | Font | Licence | Source |
|---|---|---|---|
| `inter-latin.woff2` | Inter (variable, weight 100 to 900), Latin letters only | SIL Open Font License 1.1 | Google Fonts (fonts.google.com/specimen/Inter) |
| `fraunces-latin.woff2` | Fraunces (variable, optical size and weight), Latin letters only | SIL Open Font License 1.1 | Google Fonts (fonts.google.com/specimen/Fraunces) |

They are declared in `src/app/globals.css` under the same family names the rest of the app already uses ('Inter', 'Fraunces'), so no
other file needed to change. The licence allows keeping and serving the files from this site.

To add another script (for example Latin Extended) download that subset's woff2 from Google Fonts and add a second `@font-face` with
its own `unicode-range`; the browser only downloads a subset when a page contains characters in its range.
