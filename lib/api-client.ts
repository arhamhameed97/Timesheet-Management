// Helper function to get auth token
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

// Helper function to make authenticated API calls
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}




