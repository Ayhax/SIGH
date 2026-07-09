import { Component, OnInit, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Logo } from '../logo/logo';
import { AuthService } from '../auth/auth';
import { environment } from '../../environments/environment';

// Catálogo de presentación: SOLO ruta de navegación.
// Qué módulos existen y quién los puede ver sigue viniendo de la BD (/api/modulos).
const PRESENTACION_MODULOS: Record<string, { url: string }> = {
  SCIL: { url: '/inventario' },
  CAF:  { url: '/patrimonio' },
  SCIP: { url: '/admin' },
  GUH:  { url: '/usuarios' },
  CPF:  { url: '/admin' },
  MR:   { url: '/admin' },
};
const PRESENTACION_DEFAULT = { url: '/admin' };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, Logo],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private authService = inject(AuthService);

  modulosVisibles = signal<any[]>([]);
  menuAbierto = signal(false);

  // computed() en vez de un valor fijo: si el usuario del AuthService cambia,
  // esto se recalcula solo, sin que el componente tenga que hacer nada.
  nombreUsuario = computed(() => this.authService.nombreCompleto());
  rolUsuario = computed(() => this.authService.usuario()?.role || '');

  ngOnInit(): void {
    // El authGuard en las rutas ya garantiza que solo se llega aquí con sesión activa,
    // así que ya no hace falta el chequeo manual de localStorage + redirect.
    this.cargarModulos();
  }

  private cargarModulos(): void {
    const usuario = this.authService.usuario();
    if (!usuario) return;

    fetch(`${environment.apiUrl}/api/modulos`, {
      headers: { ...this.authService.authHeader() }
    })
      .then(res => {
        if (!res.ok) throw new Error('Error en la respuesta del servidor');
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) return;
        const idsPermitidos: number[] = usuario.modulos_ids || [];

        this.modulosVisibles.set(
          data
            .filter(m => idsPermitidos.includes(m.id))
            .map(m => ({ ...m, ...(PRESENTACION_MODULOS[m.nombre] || PRESENTACION_DEFAULT) }))
        );
      })
      .catch(err => console.error('Error al cargar módulos:', err));
  }

  toggleMenu(): void {
    this.menuAbierto.update(v => !v);
  }

  navegarA(url: string): void {
    this.router.navigate([url]);
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.menuAbierto() && !this.elementRef.nativeElement.contains(event.target)) {
      this.menuAbierto.set(false);
    }
  }
}