# Image Rendering

marknative supports rendering block-level images in Markdown. Images are fetched and drawn using the native canvas backend.

## Syntax

Standard Markdown image syntax:

```markdown
![Alt text](https://example.com/photo.jpg "Optional title")
```

## Supported Sources

| Source | Example |
| :--- | :--- |
| HTTP / HTTPS URL | `https://example.com/image.png` |
| Local absolute path | `/home/user/images/photo.jpg` |
| `file://` URL | `file:///home/user/photo.png` |

```markdown
<!-- Remote image -->
![Remote](https://picsum.photos/640/480 "A photo")

<!-- Local file -->
![Local](/path/to/image.png)
```

## Layout

Block images are placed as atomic fragments — they are never split across pages. The image is scaled to fit inside the layout box while preserving its aspect ratio (object-fit: contain).

**Rendered output:**

![Block image rendered output](/examples/image-block.png)

## Fallback

If an image cannot be loaded (network error, 404, unsupported format), a placeholder box is rendered in its place, showing the image title or alt text.

```markdown
<!-- This will show a placeholder if unreachable -->
![Broken](https://example.com/does-not-exist.png "Placeholder fallback")
```

**Placeholder output:**

![Image placeholder fallback](/examples/image-placeholder.png)

## Inline Images

Inline images (`![alt](url)` inside a paragraph) are currently rendered as their **alt text** in the text flow. Full inline image rendering is not yet supported.

## Supported Formats

marknative relies on [`skia-canvas`](https://github.com/samizdatco/skia-canvas) for image decoding. The following formats are supported:

- **PNG** — including transparency
- **JPEG / JPG**
- **WebP**
- **GIF** (first frame only)
- **BMP**

SVG images are not currently supported.
