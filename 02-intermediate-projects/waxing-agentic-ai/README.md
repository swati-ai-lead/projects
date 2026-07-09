# Waxing Agentic AI

A simple booking-style web app that combines a chatbot experience with a calendar view for waxing appointments.

## What it does
- Lets users chat with a booking assistant
- Supports services such as full body, bikini, Brazilian, laser, and single-part treatments
- Includes a simple calendar interface to pick a date
- Shows a booking summary for the selected service and date

## AI upgrade
The chat experience now uses a small Node.js backend that sends user messages to a generative AI model through OpenRouter.

### Requirements
- Node.js installed locally
- An OpenRouter API key

### Setup
1. Copy `.env.example` to `.env`
2. Add your OpenRouter key to `.env`
3. Install dependencies with `npm install`
4. Start the server with `npm start`

The app will then call the backend at `http://localhost:3000/chat`.

## Why it is useful
This project shows how a simple AI concierge experience could help users book beauty appointments in a more natural, conversational way.

> Note: GitHub Pages can host the front end, but the AI chat needs a small backend. For a fully online version, deploy the backend to Render, Railway, or Vercel.
