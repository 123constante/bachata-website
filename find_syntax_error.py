
import re

file_path = 'src/pages/CreateProfile.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Only strip comments, leave strings (to identify if problem is "outside" strings or what)
# Actually, if the problem is a missing " or something, identifying it is hard.
# But let's assume strings are mostly fine.

lines = code.split('\n')
p_balance = 0

for line_idx, line in enumerate(lines):
    # Strip comments from line end
    clean_line = re.sub(r'//.*', '', line)
    
    for char in clean_line:
        if char == '(':
            p_balance += 1
        elif char == ')':
            p_balance -= 1
            if p_balance < 0:
                print(f"Negative balance at Line {line_idx+1}: {line.strip()}")
                exit()
    
print("Finished without negative balance.")
