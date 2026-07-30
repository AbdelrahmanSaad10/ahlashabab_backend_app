export const PermissionModule = {
  PORTFOLIO: 'portfolio',
  SERVICES: 'services',
  PROVIDERS: 'providers',
  BOOKINGS: 'bookings',
  USERS: 'users',
  REPORTS: 'reports',
  ROLES: 'roles',
  CMS: 'cms',
  DONATIONS: 'donations',
} as const;

export type PermissionModuleType = (typeof PermissionModule)[keyof typeof PermissionModule];

export const PermissionAction = {
  READ: 'read',
  WRITE: 'write',
} as const;

export type PermissionActionType = (typeof PermissionAction)[keyof typeof PermissionAction];

export interface PermissionMap {
  [module: string]: {
    read: boolean;
    write: boolean;
  };
}
