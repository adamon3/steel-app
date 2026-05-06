@echo off
cd /d "C:\Users\adamo\OneDrive\Desktop\steel-app"
echo === GIT STATUS ===
"C:\Program Files\Git\cmd\git.exe" status
echo === ADDING ALL ===
"C:\Program Files\Git\cmd\git.exe" add -A
echo === DIFF STAGED ===
"C:\Program Files\Git\cmd\git.exe" diff --cached --stat
echo === COMMITTING ===
"C:\Program Files\Git\cmd\git.exe" commit -m "Add CLAUDE.md project docs and sync workspace files"
echo === PUSHING ===
"C:\Program Files\Git\cmd\git.exe" push origin main
echo === DONE ===
