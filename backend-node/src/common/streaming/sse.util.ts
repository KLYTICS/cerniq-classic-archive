import { Observable } from 'rxjs';

export interface SSEData {
  token?: string;
  type: 'token' | 'done' | 'error';
  message?: string;
}

/**
 * Wraps an AsyncGenerator<string> into an Observable<MessageEvent> for NestJS @Sse().
 * Each yielded string becomes an SSE "token" event; completion sends "done".
 */
export function createSSEStream(
  generator: AsyncGenerator<string>,
): Observable<MessageEvent> {
  return new Observable((subscriber) => {
    void (async () => {
      try {
        for await (const token of generator) {
          subscriber.next({ data: { token, type: 'token' } } as any);
        }
        subscriber.next({ data: { type: 'done' } } as any);
        subscriber.complete();
      } catch (err: any) {
        subscriber.next({
          data: { type: 'error', message: err.message || 'Stream error' },
        } as any);
        subscriber.error(err);
      }
    })();
  });
}
