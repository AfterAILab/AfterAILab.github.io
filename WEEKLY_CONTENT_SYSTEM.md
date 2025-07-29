# AfterAI Weekly - Improved Content Management System

## Overview

The AfterAI Weekly issues have been refactored from individual HTML files with duplicated code into a **data-driven template system**. This dramatically reduces code duplication and makes content management much more efficient.

## New Structure

### Before (Problems)
- ❌ 8 separate HTML files with 100+ lines each
- ❌ Massive code duplication for navigation, headers, transcriptions
- ❌ Manual updates needed in multiple places
- ❌ Hard to maintain consistency across issues

### After (Solutions)
- ✅ Single template (`_layouts/weekly_issue.html`) for all issues
- ✅ Centralized data file (`_data/weekly_issues.yml`) with all content
- ✅ Each issue file is now just 4 lines of front matter
- ✅ Easy to add new issues and maintain existing ones

## File Structure

```
_data/
  └── weekly_issues.yml          # All issue content and metadata
_layouts/
  └── weekly_issue.html          # Single template for all issues
weekly/
  ├── vol1.html                  # 4 lines: just front matter
  ├── vol2.html                  # 4 lines: just front matter
  └── ...                        # etc.
generate_weekly_issues.rb        # Script to regenerate all issue files
add_new_issue.rb                # Script to add new issues
```

## How It Works

1. **Data File (`_data/weekly_issues.yml`)**: Contains all issue content including titles, descriptions, transcriptions, and quotes in both English and Japanese.

2. **Template (`_layouts/weekly_issue.html`)**: A single Jekyll template that dynamically renders any issue based on the `slug` parameter.

3. **Issue Files (`weekly/vol*.html`)**: Minimal files with just front matter that specify which issue to render.

## Managing Content

### Adding a New Issue

Use the interactive script:
```bash
ruby add_new_issue.rb
```

Or manually:
1. Add issue data to `_data/weekly_issues.yml`
2. Create a minimal HTML file in `weekly/` folder
3. Add corresponding images to `img/weekly/en/` and `img/weekly/ja/`

### Editing Existing Issues

Just edit the content in `_data/weekly_issues.yml` — no need to touch individual HTML files.

### Regenerating All Issue Files

If you need to recreate all the minimal HTML files:
```bash
ruby generate_weekly_issues.rb
```

## Benefits

1. **DRY (Don't Repeat Yourself)**: Template logic exists in one place
2. **Easy Maintenance**: Update navigation or styling once, applies everywhere
3. **Content Focus**: Writers focus on content, not HTML structure
4. **Consistency**: Impossible to have inconsistent layouts between issues
5. **Scalability**: Adding issue #100 is as easy as adding issue #9

## Migration Notes

- All existing functionality is preserved
- URLs remain the same (`/weekly/vol1.html`, etc.)
- Bilingual support continues to work
- Navigation between issues is automatically generated
- Archive page now dynamically lists all issues

## Example Data Structure

```yaml
- number: 1
  slug: vol1
  title:
    en: "Hello, Handwritten World!"
    ja: "こんにちは、手書きの世界！"
  description:
    en: "Our very first issue..."
    ja: "人間中心のAIインサイト..."
  transcription:
    en: |
      Paragraph 1...
      
      Paragraph 2...
    ja: |
      段落 1...
      
      段落 2...
  quote:
    en: "The future isn't about replacing..."
    ja: "未来は人間的タッチを..."
```

This system makes the AfterAI Weekly much more maintainable and scalable! 🚀
