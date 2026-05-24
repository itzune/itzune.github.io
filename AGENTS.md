# AGENTS.md

## How to add a new project to the Itzune website

To add or modify a project, edit **only** `data/projects.json`.  
Do **not** edit `index.html` for project content.

### `data/projects.json` structure

```json
{
  "projects": [
    {
      "id": "my-project",
      "tag": "models",
      "title": {
        "eu": "Proiektuaren izena",
        "en": "Project name"
      },
      "url": "https://...",
      "body": {
        "eu": "Euskarazko deskribapena.",
        "en": "Description in English."
      }
    }
  ]
}
```

### Rules

- `tag`: one of `"models"`, `"datasets"`, `"others"`  
- `title` and `body`: always provide both `eu` and `en` translations  
- `url`: full URL (external resources open in new tab automatically)  
- `status`: optional object `{ "eu": "argitaratua", "en": "published" }` — defaults to the general status from i18n if omitted  
- No need to touch `index.html` — the page renders all projects dynamically from this file, preserving existing design/layout  
- The site filters (all / models / datasets / others) work automatically based on `tag`