import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Custom error class with structured error info
export class ApiError extends Error {
  status: number;
  statusText: string;
  data?: { message?: string; errors?: Record<string, string[]> };

  constructor(status: number, statusText: string, data?: { message?: string; errors?: Record<string, string[]> }) {
    const message = data?.message || statusText || `Erro ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let data: { message?: string; errors?: Record<string, string[]> } | undefined;
    
    // Try to parse JSON error response from backend
    try {
      const text = await res.text();
      if (text) {
        data = JSON.parse(text);
      }
    } catch {
      // Not JSON, ignore
    }
    
    throw new ApiError(res.status, res.statusText, data);
  }
}

// Helper to extract error message from any error type
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Ocorreu um erro inesperado";
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
