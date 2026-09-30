import { Hono } from 'hono';

export interface Booking {
  id: string;
  roomId: string;
  start: string;
  end: string;
  bookedBy: string;
  createdAt: string;
}

export interface AppDeps {
  now?: () => Date;
  newId?: () => string;
}

export function createApp(deps: AppDeps = {}): Hono {
  void deps;
  const app = new Hono();
  // Routes go here.
  return app;
}
