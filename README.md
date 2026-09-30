# CA Lottery Scratchers App

A React + Vite application that displays real-time California Lottery scratcher statistics, odds, expected value (EV), and prize tables by proxying live data from `calottery.com`.

## Requirements

- **Node.js**: Version 22+ (configured for Vercel and local dev via [nvm](https://github.com/nvm-sh/nvm)):
  ```bash
  nvm install 22
  nvm use 22
  ```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser. Live data is fetched through a built-in local Vite dev server proxy middleware (`/api/proxy`).

## Production & Deployment (Vercel)

- **Build**:
  ```bash
  npm run build
  ```
- **Deployment**: 
  The app is configured for Vercel deployment using Node 22 (`vercel.json`) and a serverless API proxy (`api/proxy.js`) which fetches live data server-side from `calottery.com`, entirely bypassing browser CORS restrictions. Push to your connected Vercel repository to deploy.
