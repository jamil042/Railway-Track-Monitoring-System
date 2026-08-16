import type { NextFunction, Request, Response } from 'express'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message })
    return
  }

  const sqliteErr = err as { code?: string; message?: string }
  if (typeof sqliteErr.code === 'string' && sqliteErr.code.startsWith('SQLITE_CONSTRAINT')) {
    res.status(400).json({ error: `Invalid data: ${sqliteErr.message}` })
    return
  }

  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}