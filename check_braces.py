
import re

file_path = 'src/pages/CreateProfile.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines):
    # Ignore comments roughly (basic check)
    clean_line = re.sub(r'//.*', '', line)
    
    for char in clean_line:
        if char == '{':
            balance += 1
        elif char == '}':
            balance -= 1
    
if balance != 0:
    print(f"Final balance: {balance}")
    print("Finding likely location...")
    
    # Second pass to find where it might have gone wrong
    curr_balance = 0
    for i, line in enumerate(lines):
         # Ignore comments roughly
        clean_line = re.sub(r'//.*', '', line)
        for char in clean_line:
            if char == '{':
                curr_balance += 1
            elif char == '}':
                curr_balance -= 1
        
        # Heuristic: If we are deep indentation but low balance, or vice versa?
        # Actually, let's just print the balance every 100 lines to narrow it down
        if (i+1) % 100 == 0:
            print(f"Line {i+1} Balance: {curr_balance}")

else:
    print("Braces are balanced.")
