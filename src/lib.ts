// Join a site-relative path with the deployment base ("/agentic-website").
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string) => base + (path.startsWith('/') ? path : '/' + path);
