// Cloudflare Pages Function - SPA fallback
// This catches all routes and serves index.html for client-side routing

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // List of file extensions that should be served directly (not as SPA)
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.webmanifest', '.json', '.txt', '.xml'
  ];

  // Check if this is a request for a static file
  const isStaticFile = staticExtensions.some(ext => path.endsWith(ext));

  if (isStaticFile) {
    // Let Cloudflare serve the static file normally
    return context.next();
  }

  // For all other routes, serve index.html (SPA fallback)
  try {
    // Fetch index.html from the same origin
    const indexUrl = new URL('/index.html', url.origin);
    const response = await context.env.ASSETS.fetch(indexUrl);

    // Return index.html with correct content type
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (e) {
    // If index.html can't be fetched, pass through to default handling
    return context.next();
  }
}
