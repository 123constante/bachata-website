import os

code_to_write = r'''
import os
import re

def restore_file(path, replacements):
    if not os.path.exists(path):
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, replacement in replacements:
        new_content = re.sub(pattern, replacement, new_content)
    
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Restored {path}')
    else:
        print(f'No changes for {path}')

# EventCalendar.tsx
# Note: Replacements are regular strings now to allow unicode escape parsing
cal_repls = [
    (r"category === 'all' && <span className=\"text-xs\"></span>", 
     "category === 'all' && <span className=\"text-xs\">\u2728</span>"),
    (r"category === 'parties' && <span className=\"text-xs\"></span>", 
     "category === 'parties' && <span className=\"text-xs\">\U0001F389</span>"),
    (r"category === 'classes' && <span className=\"text-xs\"></span>", 
     "category === 'classes' && <span className=\"text-xs\">\U0001F393</span>"),
    (r"<span></span>\s*<span className=\"truncate\">", 
     "<span>\u2022</span>\n<span className=\"truncate\">"),
    (r"className=\"text-xs text-primary hover:underline\">\s*Back to London", 
     "className=\"text-xs text-primary hover:underline\">\n                       \u2190 Back to London"),
    (r"cursor-default\">\s*Select a date", 
     "cursor-default\">\n                               \U0001F447 Select a date"),
    (r"text-\[8px\]\">\s*</div>", 
     "text-[8px]\">\n                                                  \U0001F464\n                                                </div>"),
    (r"text-4xl mb-3\"></div>", 
     "text-4xl mb-3\">\U0001F3DC\uFE0F</div>"),
    (r"className=\"text-4xl mb-3\">\s*</motion.div>", 
     "className=\"text-4xl mb-3\">\n                      \U0001F30A\n                    </motion.div>"),
    (r"event\.type === 'parties' \? <span className=\"text-lg\"></span> : <span className=\"text-lg\"></span>",
     "event.type === 'parties' ? <span className=\"text-lg\">\U0001F389</span> : <span className=\"text-lg\">\U0001F393</span>"),
    (r"event\.type === 'parties' \? '' : ''", 
     "event.type === 'parties' ? '\U0001F389' : '\U0001F393'")
]

# EventDetail.tsx
det_repls = [
    (r"teacher\.name\?\.charAt\(0\) \|\| ''", "teacher.name?.charAt(0) || '\U0001F393'"),
    (r"dj\.name\?\.charAt\(0\) \|\| ''", "dj.name?.charAt(0) || '\U0001F3A7'"),
    (r"organiser\.name\?\.charAt\(0\) \|\| ''", "organiser.name?.charAt(0) || '\U0001F4C5'"),
    (r"AvatarFallback className=\"bg-primary/10 text-primary\">\s*</AvatarFallback>", 
     "AvatarFallback className=\"bg-primary/10 text-primary\">\n                      \U0001F3DB\uFE0F\n                    </AvatarFallback>"),
    # Double backslash for group refs in regular string
    (r"\{formatTime\(event\.([a-z_]+_start)\)\} \s*\{formatTime\(event\.([a-z_]+_end)\)\}", 
     "{formatTime(event.\\1)} \u2013 {formatTime(event.\\2)}")
]

restore_file('src/components/EventCalendar.tsx', cal_repls)
restore_file('src/pages/EventDetail.tsx', det_repls)
'''

with open('restore.py', 'w', encoding='utf-8') as f:
    f.write(code_to_write)
