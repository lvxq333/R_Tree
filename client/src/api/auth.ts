import type { AuthConfig, AuthUser, RegisterInput } from '@shared/api.interface';
import { axiosForBackend } from '@/lib/runtime';

export async function getAuthConfig(): Promise<AuthConfig> {
  return (await axiosForBackend.get<AuthConfig>('/api/auth/config')).data;
}
export async function getAuthUser(): Promise<AuthUser | null> {
  return (await axiosForBackend.get<AuthUser | null>('/api/auth/me')).data;
}
export async function login(username: string, password: string): Promise<AuthUser> {
  return (await axiosForBackend.post<AuthUser>('/api/auth/login', { username, password })).data;
}
export async function logout(): Promise<void> {
  await axiosForBackend.post('/api/auth/logout');
}
export async function register(input: RegisterInput): Promise<AuthUser> {
  return (await axiosForBackend.post<AuthUser>('/api/auth/register', input)).data;
}
