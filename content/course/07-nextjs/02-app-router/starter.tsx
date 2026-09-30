'use client';

type Props = { error: Error; retry: () => void };

export default function ErrorPage({ error }: Props) {
  return <p>Error</p>;
}
