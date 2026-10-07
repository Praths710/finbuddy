// Backend URL. Set REACT_APP_API_URL in Vercel (or a local .env) to override.
// `npm start` talks to a local backend; production builds talk to Render.
export const API_BASE =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'
    : 'https://finbuddy-api-python.onrender.com');
