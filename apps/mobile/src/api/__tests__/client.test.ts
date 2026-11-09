import { ApiError, API_URL, NetworkError, request } from '../client';

const mockFetch = jest.fn();

function respond(status: number, body: unknown, statusText = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new Error('not json');
      return body;
    },
  };
}

describe('request', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('calls the API with the demo user header and returns parsed JSON', async () => {
    mockFetch.mockResolvedValueOnce(respond(200, { status: 'ok' }));

    await expect(request('/health')).resolves.toEqual({ status: 'ok' });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/health`);
    expect(init.headers).toMatchObject({ Accept: 'application/json', 'X-User-Id': 'demo' });
  });

  it('throws ApiError carrying the status and the server detail', async () => {
    mockFetch.mockResolvedValueOnce(respond(404, { detail: 'Note not found' }));

    const error = await request('/notes/9').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Note not found' });
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce(respond(502, undefined, 'Bad Gateway'));

    await expect(request('/notes')).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' });
  });

  it('throws NetworkError when the request never reaches the server', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(request('/notes')).rejects.toBeInstanceOf(NetworkError);
  });

  it('aborts and reports a NetworkError after the timeout', async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = request('/slow', {}, 1000).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(1000);

    expect(await pending).toBeInstanceOf(NetworkError);
    jest.useRealTimers();
  });
});
