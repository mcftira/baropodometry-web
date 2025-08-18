# Setup Instructions

## Environment Variables

1. Copy `env.example` to `.env.local`
2. Add your OpenAI API key and Assistant IDs

The app will work with the following defaults if you don't set them:
- Uses the API key from `../Config/settings.json` if available
- Uses the default Assistant IDs from the baropodometry_agent setup

## Running the App

```bash
npm install
npm run dev
```

Open http://localhost:3001 in your browser.

## Features

- Upload 3 PDF reports (Neutral, Closed Eyes, Cotton Rolls)
- Automatic analysis using OpenAI Vision Assistant
- JSON output with metrics and comparisons
- Settings page for API configuration
