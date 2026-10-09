# Pharma Ist — User Manual

End-user manual for the Pharma Ist pharmacy management system, generated as a
Word document (`.docx`) from a Node script so it can be rebuilt whenever the
app changes.

## Files

| File | What it is |
| --- | --- |
| `Pharma-Ist-User-Manual.docx` | The built manual (committed so you can share it without building). |
| `build-manual.js` | The generator — all manual content lives here, as structured `docx` elements. |
| `images/` | The 18 screenshots embedded in the manual (`01-login.jpg` … `18-help.jpg`). |
| `package.json` | Declares the one dependency (`docx`). |

## Rebuild the manual

```bash
cd docs/user-manual
npm install        # first time only — pulls in the `docx` library
npm run build      # regenerates Pharma-Ist-User-Manual.docx
```

The script reads every image from `images/` and writes
`Pharma-Ist-User-Manual.docx` next to itself.

## Updating content

- **Text / steps / scenarios:** edit `build-manual.js`. Content is built with
  small helpers — `h1/h2/h3` (headings), `p` (paragraph), `bullets`, `steps`
  (auto-numbered, each list restarts at 1), `callout` (Note/Tip/Warning boxes)
  and `shot(file, caption)` (an embedded screenshot). Then `npm run build`.
- **Screenshots:** replace the matching file in `images/` (keep the same
  filename and a ~4:3 aspect ratio, e.g. 800×600), then rebuild. To add a new
  screenshot, drop it in `images/` and reference it with
  `shot('NN-name.jpg', 'caption')`.

## Notes

- Screenshots use the "Divya Care Pharmacy" demo tenant and sample data; the
  screens and controls are identical to a real pharmacy's.
- The structure (15 chapters + 8 end-to-end scenarios) mirrors the app's
  navigation, so when a module changes, update that chapter and its screenshot.
