@echo off
echo Creating .env.local file...
echo.
echo Please enter your database connection details:
echo.
set /p DB_URL="Database URL (from Neon or local PostgreSQL): "
set /p NEXTAUTH_SECRET="NextAuth Secret (any random string): "
set /p GOOGLE_CLIENT_ID="Google Client ID: "
set /p GOOGLE_CLIENT_SECRET="Google Client Secret: "
set /p DEMO_EMAIL="Demo Email (optional, defaults to demo@chat.app): "
set /p DEMO_PASSWORD="Demo Password (optional, defaults to demo1234): "

echo DATABASE_URL="%DB_URL%"> .env.local
echo NEXTAUTH_SECRET="%NEXTAUTH_SECRET%">> .env.local
echo NEXTAUTH_URL="http://localhost:3000">> .env.local
echo GOOGLE_CLIENT_ID="%GOOGLE_CLIENT_ID%">> .env.local
echo GOOGLE_CLIENT_SECRET="%GOOGLE_CLIENT_SECRET%">> .env.local
if not "%DEMO_EMAIL%"=="" echo DEMO_EMAIL="%DEMO_EMAIL%">> .env.local
if not "%DEMO_PASSWORD%"=="" echo DEMO_PASSWORD="%DEMO_PASSWORD%">> .env.local

echo.
echo ✅ .env.local file created successfully!
echo.
echo Restarting Next.js application...
echo.
npm run dev
