import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  module: string;
  action: 'read' | 'write';
}

export const RequirePermission = (module: string, action: 'read' | 'write' = 'read') =>
  SetMetadata(PERMISSION_KEY, { module, action } as RequiredPermission);
