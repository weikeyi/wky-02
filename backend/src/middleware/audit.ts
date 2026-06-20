import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

export async function auditLog(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, any>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
        ip: req.ip || null,
      },
    });
  } catch (e) {
    console.error('审计日志写入失败:', e);
  }
}

export function auditMiddleware(action: string, entity: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', async () => {
      if (res.statusCode < 400) {
        const entityId = req.params.id || req.body?.id;
        await auditLog(req, action, entity, entityId, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        });
      }
    });
    next();
  };
}
