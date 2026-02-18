import os

def apply_fix(path, replacements):
    if not os.path.exists(path):
        print(f"Skipping {path}")
        return

    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    count = 0
    for search, replace in replacements:
        if search in new_content:
            c = new_content.count(search)
            new_content = new_content.replace(search, replace)
            print(f"Replaced {c} occurrences of {ascii(search)} in {path}")
            count += c
    
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Saved changes to {path}")
    else:
        print(f"No matches found in {path}")

# EventCalendar.tsx
cal_repls = [
    ('\u2018\u2021', '\U0001F447'),
    ('\u2030', '\U0001F389'),
    ('\u201C', '\U0001F393'),
    ('\u2018\u00A4', '\U0001F464'),
    ('\u00A2', '\u2022'),
    ('\u008F\u0153\u00EF\u00B8\u008F', '\U0001F3DC\uFE0F'),
    ('\u2020\u0090', '\u2190'),
    ('\u00A8', '\u2728'),
    ('ðŸŽ', '\U0001F389'),
    ('ðŸŽ', '\U0001F393')
]

# EventDetail.tsx
det_repls = [
    ('\u00F0\u0178\u017D\u00A7', '\U0001F3A7'),
    ('\u00F0\u0178\u017D\u201C', '\U0001F393'),
    ('\u00F0\u0178\u017D\u00AD', '\U0001F4C5'),
    ('\u00F0\u0178\u008F\u203A\u00EF\u00B8\u008F', '\U0001F3DB\uFE0F'),
    ('\u00E2\u20AC\u2013', '\u2013'),
    ('\u00E2\u20AC\u201C', '\u2013')
]

apply_fix('src/components/EventCalendar.tsx', cal_repls)
apply_fix('src/pages/EventDetail.tsx', det_repls)
