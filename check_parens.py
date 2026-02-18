
import re

file_path = 'src/pages/CreateProfile.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Remove strings (simple)
code_no_strings = re.sub(r'(".*?"|\'.*?\'|`.*?`)', '""', code, flags=re.DOTALL)
# Remove comments
code_no_comments = re.sub(r'//.*', '', code_no_strings)
code_no_comments = re.sub(r'/\*.*?\*/', '', code_no_comments, flags=re.DOTALL)

p_balance = 0
b_balance = 0
for i, char in enumerate(code_no_comments):
    if char == '(':
        p_balance += 1
    elif char == ')':
        p_balance -= 1
        if p_balance < 0:
             print(f"Negative Paren Balance at char {i}")
    elif char == '[':
        b_balance += 1
    elif char == ']':
        b_balance -= 1

print(f"Paren Balance: {p_balance}")
print(f"Bracket Balance: {b_balance}")
