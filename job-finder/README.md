# HireLift

A targeted hiring-manager dashboard where recruiters and hiring leaders post open roles and candidate-fit context instead of generic job listings. The app is built with plain HTML, CSS, and JavaScript for a lightweight static deployment.

## Run locally

```bash
cd job-finder
python -m http.server 3000
```

Then open http://localhost:3000 in your browser.

## Features

- Searchable hiring-manager profiles and active hiring posts
- Filters for location, function, experience, and response time
- Save/favorite profile workflow
- Detailed profile sidebar showing hiring context and what the manager is looking for
- Responsive layout for desktop and mobile

## Deploy to Vercel

```bash
cd job-finder
npx vercel --prod
```
