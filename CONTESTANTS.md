# Adding the Season 2 contestants

1. Create the folder `assets/contestants` if it does not already exist.
2. Put each portrait in that folder. Use short web-friendly filenames such as `maya-chen.jpg`.
3. Open `contestants.js` and replace each temporary castaway entry with the real information.

Example:

```js
{
  id: 1,
  name: "Maya Chen",
  photo: "assets/contestants/maya-chen.jpg",
  college: "Lovett",
  year: "Junior",
  major: "Economics",
  bio: "Maya loves puzzles, pickup soccer, and a perfectly timed blindside."
}
```

Keep every `id` unique and do not change an ID after tribal results have been recorded for that contestant. Portraits work best when they are vertical, consistently cropped, and at least 800 by 1000 pixels. JPG and WebP files keep the site fast; aim for less than 500 KB per photo.

The `photo` value must be a website-relative path beginning with `assets/contestants/`. Do not paste a full Mac path beginning with `/Users/`; that path only exists on your computer and cannot be loaded by the deployed website.

Tribes are intentionally not stored yet. Once tribes are announced, add a `tribe` field to each contestant and update the cast display if tribe filters are wanted.
