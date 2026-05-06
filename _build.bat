@echo off
cd /d "C:\Users\adamo\OneDrive\Desktop\steel-app"
echo === GIT STATUS ===
"C:\Program Files\Git\cmd\git.exe" status
echo === GIT REMOTE ===
"C:\Program Files\Git\cmd\git.exe" remote -v
echo === GIT LOG ===
"C:\Program Files\Git\cmd\git.exe" log --oneline -5
echo === DONE ===
