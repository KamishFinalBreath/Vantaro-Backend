import { createApp } from '../src/app.js';

// Vercel serverless entry: exporting an Express app as default lets Vercel
// route all requests to it. See vercel.json rewrites.
const app = createApp();

export default app;