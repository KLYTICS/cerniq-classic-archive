/**
 * Simple routing helper for Bun.js
 * Provides Express-like routing without the overhead
 */

type RouteHandler = (req: Request, params?: any) => Response | Promise<Response>;

class Router {
  private routes: Map<string, Map<string, RouteHandler>> = new Map();
  
  constructor() {
    // Initialize method maps
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach(method => {
      this.routes.set(method, new Map());
    });
  }
  
  get(path: string, handler: RouteHandler) {
    this.routes.get('GET')!.set(path, handler);
    return this;
  }
  
  post(path: string, handler: RouteHandler) {
    this.routes.get('POST')!.set(path, handler);
    return this;
  }
  
  put(path: string, handler: RouteHandler) {
    this.routes.get('PUT')!.set(path, handler);
    return this;
  }
  
  delete(path: string, handler: RouteHandler) {
    this.routes.get('DELETE')!.set(path, handler);
    return this;
  }
  
  fetch = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const method = req.method;
    
    // CORS
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    // Find matching route
    const methodRoutes = this.routes.get(method);
    if (!methodRoutes) {
      return error(405, 'Method not allowed');
    }
    
    for (const [pattern, handler] of methodRoutes.entries()) {
      const match = this.matchRoute(pattern, url.pathname);
      if (match) {
        try {
          const response = await handler(req, match.params);
          
          // Add CORS headers
          if (response) {
            const headers = new Headers(response.headers);
            headers.set('Access-Control-Allow-Origin', '*');
            
            return new Response(response.body, {
              status: response.status,
              headers
            });
          }
        } catch (err: any) {
          console.error('Route handler error:', err);
          return error(500, err.message);
        }
      }
    }
    
    return error(404, 'Not found');
  };
  
  private matchRoute(pattern: string, pathname: string) {
    // Convert pattern like "/api/:id" to regex
    const paramNames: string[] = [];
    const regexPattern = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    
    const regex = new RegExp(`^${regexPattern}$`);
    const match = pathname.match(regex);
    
    if (!match) return null;
    
    const params: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });
    
    return { params };
  }
}

// Helper functions
export function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export function error(status: number, message: string): Response {
  return json({
    error: message,
    status,
    timestamp: new Date().toISOString()
  }, status);
}

export const router = new Router();
