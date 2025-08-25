# Local Deployment Setup for Doctor's Laptop

## Prerequisites Installation (One-time setup)

### 1. Install Git for Windows
- Download from: https://git-scm.com/download/win
- During installation, use all default options
- This allows the app to auto-update from GitHub

### 2. Install Node.js
- Download from: https://nodejs.org/
- Choose the "LTS" version (recommended)
- During installation, use all default options

### 3. Clone the Repository
Open Command Prompt or PowerShell and run:
```bash
cd C:\
git clone https://github.com/mcftira/baropodometry-web.git BaropodometryApp
cd BaropodometryApp
```

### 4. Configure Environment Variables
1. Navigate to `C:\BaropodometryApp\baropodometry-web`
2. Find the file `env.local.template`
3. Copy it and rename the copy to `.env.local`
4. Open `.env.local` in Notepad
5. Replace `sk-your-openai-api-key-here` with your actual OpenAI API key
6. Save and close the file

### 5. Initial Setup
1. Double-click `Start-Baropodometry.bat`
2. Wait for the initial installation (first time takes 2-3 minutes)
3. The browser will open automatically at http://localhost:3001

## Daily Usage

### Starting the Application
1. Double-click `Start-Baropodometry.bat` on the desktop (or wherever you saved it)
2. The batch file will:
   - Check for updates from GitHub
   - Update dependencies if needed
   - Start the application
   - Open your browser automatically

### Stopping the Application
- Close the command window (black window)
- Or press `Ctrl+C` in the command window and type `Y`

## Creating Desktop Shortcut

1. Right-click on `Start-Baropodometry.bat`
2. Select "Send to" → "Desktop (create shortcut)"
3. Optionally rename the shortcut to "Baropodometry Analyzer"

## Troubleshooting

### "Git is not recognized as a command"
- Git is not installed or not in PATH
- Reinstall Git for Windows using the installer

### "npm is not recognized as a command"
- Node.js is not installed or not in PATH
- Reinstall Node.js using the installer

### "Cannot pull updates"
- The app will still work with the current version
- Check internet connection
- Updates will be fetched next time you start

### Application won't start
1. Check that `.env.local` exists and has your OpenAI API key
2. Delete `node_modules` folder and try again
3. Run `npm install` manually in the folder

### Port 3001 is already in use
- Another instance might be running
- Close all command windows and try again
- Or edit `package.json` to use a different port

## Important Notes

- **Never share or commit `.env.local`** - it contains your secret API key
- The command window must stay open while using the app
- Processing can take 5-6 minutes - this is normal
- No timeout issues when running locally!

## Support

For issues or updates, contact the development team or check:
https://github.com/mcftira/baropodometry-web
