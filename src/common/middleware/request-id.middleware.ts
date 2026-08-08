import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * A handle on a single request.
 *
 * When a 500 happened there was nothing tying the log line to the request that
 * caused it. The unhandled-exception filter logged `Unhandled exception:` and a
 * stack, into a pm2 log shared with three other applications, with no method, no
 * path and no way to connect it to the person who reported the problem. "It broke
 * around lunchtime" was the whole of the evidence available.
 *
 * Every request now carries an id: returned in `X-Request-Id`, included in the
 * error body a user can quote, and attached to whatever gets logged about it.
 *
 * An inbound `X-Request-Id` is honoured so a trace survives the proxy in front of
 * this process, and length-capped because it lands in log lines — an unbounded
 * header value is a log-flooding lever for anyone who finds it.
 */

const MAX_INBOUND_LENGTH = 64;

export interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction) {
    const inbound = req.header('x-request-id');
    const id =
      inbound && inbound.length <= MAX_INBOUND_LENGTH ? inbound : randomUUID();

    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}
