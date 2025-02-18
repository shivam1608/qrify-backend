import { Context } from 'hono';

declare module 'hono' {
  interface Context {
    jwt: string;  // Adjust the type as per your actual use case, such as a JWT token or an object.
  }
}
