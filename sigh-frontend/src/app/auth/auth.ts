import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

// Forma de los datos del usuario que guardamos en localStorage y usamos en la app
export interface Usuario {
  nombres: string;
  apellidos: string;
  role: string;
  modulos_ids: number[];
}

const KEY_USUARIO = 'usuario';
const KEY_TOKEN = 'token';

@Injectable({
  providedIn: 'root' // Un solo AuthService compartido en toda la app, sin necesidad de agregarlo a ningún array de 'providers'
})
export class AuthService {
  // Signal privado: solo el propio servicio puede cambiarlo (evita que un componente
  // lo modifique por accidente sin pasar por login()/logout())
  private _usuario = signal<Usuario | null>(this.leerUsuarioGuardado());

  // Signal público de solo lectura: los componentes lo leen con authService.usuario()
  readonly usuario = this._usuario.asReadonly();

  private leerUsuarioGuardado(): Usuario | null {
    const raw = localStorage.getItem(KEY_USUARIO);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  }

  /**
   * Intenta iniciar sesión contra el backend.
   * Devuelve true/false en vez de lanzar excepción, para que el componente
   * decida fácilmente qué mostrar (if/else), sin try/catch obligatorio.
   */
  async login(username: string, password: string): Promise<{ ok: boolean; mensaje?: string }> {
    try {
      const response = await fetch(`${environment.apiUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return { ok: false, mensaje: data.message || 'Usuario o contraseña incorrectos.' };
      }

      const usuario: Usuario = {
        nombres: data.nombres,
        apellidos: data.apellidos,
        role: data.role,
        modulos_ids: data.modulos_ids || []
      };

      localStorage.setItem(KEY_TOKEN, data.token);
      localStorage.setItem(KEY_USUARIO, JSON.stringify(usuario));
      this._usuario.set(usuario);

      return { ok: true };
    } catch (error) {
      console.error('Error de conexión durante el login:', error);
      return { ok: false, mensaje: 'Error de conexión con el servidor.' };
    }
  }

  logout(): void {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USUARIO);
    this._usuario.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(KEY_TOKEN);
  }

  isAuthenticated(): boolean {
    return this._usuario() !== null;
  }

  /** Nombre completo, listo para mostrar en el header */
  nombreCompleto(): string {
    const u = this._usuario();
    if (!u) return '';
    return `${u.nombres || ''} ${u.apellidos || ''}`.trim();
  }

  /** Helper para armar el header Authorization en cualquier fetch protegido */
  authHeader(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}