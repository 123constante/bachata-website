
import re

file_path = 'src/pages/CreateProfile.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Remove strings
# This regex is a bit simplistic but works for '...' and "..." and `...`
# It handles escaped quotes
code_no_strings = re.sub(r'(".*?"|\'.*?\'|`.*?`)', '""', code, flags=re.DOTALL)

# Remove comments
code_no_comments = re.sub(r'//.*', '', code_no_strings)
code_no_comments = re.sub(r'/\*.*?\*/', '', code_no_comments, flags=re.DOTALL)

balance = 0
lines = code.split('\n')
clean_lines = code_no_comments.split('\n')

for i, line in enumerate(clean_lines):
    for char in line:
        if char == '{':
            balance += 1
        elif char == '}':
            balance -= 1
            
    if (i+1) % 100 == 0:
        print(f"Line {i+1}: {balance}")

print(f"Final Balance: {balance}")
