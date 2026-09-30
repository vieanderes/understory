export interface Req {
  method: string;
  path: string;
  body: string;
}

export interface Res {
  status: number;
  body: string;
}

function json(status: number, data: unknown): Res {
  return { status, body: JSON.stringify(data) };
}

// Stands in for the fetch to the model API. It throws on failure, like fetch does.
export type CallModel = (question: string, key: string) => Promise<string>;

export async function ask(request: Req, env: Record<string, string>, callModel: CallModel): Promise<Res> {
  const data = JSON.parse(request.body);
  if (typeof data.question !== 'string' || data.question === '') {
    return json(400, { error: 'Send a question' });
  }
  try {
    const answer = await callModel(data.question, env.MODEL_API_KEY ?? '');
    return json(200, { answer });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return json(504, { error: 'The model took too long' });
    }
    return json(502, { error: 'The model service failed' });
  }
}
