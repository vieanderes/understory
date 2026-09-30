'use client';

type Props = { error: Error; retry: () => void };

export default function ErrorPage({ error, retry }: Props) {
  return (
    <div>
      <h2>Couldn't load the recipes</h2>
      <p>{error.message}</p>
      <button onClick={() => retry()}>Try again</button>
    </div>
  );
}
