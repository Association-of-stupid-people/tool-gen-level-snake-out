@echo off
SET PATH=C:\Program Files\nodejs;C:\Users\DMOBIN\AppData\Local\Programs\Python\Python311;C:\Users\DMOBIN\AppData\Local\Programs\Python\Python311\Scripts;%PATH%
echo Starting frontend only...
cd client
npm run dev
pause
