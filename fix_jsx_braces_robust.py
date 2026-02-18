import re

files_to_fix = [
    'src/pages/Experience.tsx',
    'src/components/PeopleFocusSection.tsx'
]

# We are looking for literal strings found in the file: \u{1234}
# We want to replace them with {'\u1234'} OR just the character itself if we can
# But earlier we put them there to AVOID encoding issues.
# JS/React supports \u{1F30E} code point escapes in strings.
# But inside JSX Text, backslashes are mostly literals.
# So >\u{1F30E}< renders as that text literally, OR causes syntax error depending on parser.
# The previous error "Expected </ got D" suggests it saw \u{270D} and got confused.

# The safest way is to wrap in expression: { "\u1F30E" } 
# Note: Python regex needs double escaping for backslashes.

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern: >\u{XXXX}< or >\u{XXXX}\u{YYYY}<
        # We'll just replace specific known strings blindly for safety
        
        replacements = [
            # Experience
            (r"\\u\{1F30E\}", "{'\\u1F30E'}"),
            (r"\\u\{1F3A5\}", "{'\\u1F3A5'}"),
            (r"\\u\{1F483\}", "{'\\u1F483'}"),
            
            # PeopleFocus
            (r"\\u\{1F393\}", "{'\\u1F393'}"),
            (r"\\u\{1F3A7\}", "{'\\u1F3A7'}"),
            (r"\\u\{1F496\}", "{'\\u1F496'}")
        ]

        new_content = content
        for old, new in replacements:
             # simple replace is safer than regex for these specific literals
            if old in new_content:
                 new_content = new_content.replace(old, new)
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Fixed " + filepath)
        else:
             print("Nothing to fix in " + filepath)
             
    except Exception as e:
        print("Error: " + str(e))

for f in files_to_fix:
    fix_file(f)
