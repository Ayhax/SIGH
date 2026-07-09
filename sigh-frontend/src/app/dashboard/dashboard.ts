import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Logo } from '../logo/logo'; 

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

  modulosVisibles = signal<any[]>([]);
  nombreUsuario = signal('');
  rolUsuario = signal('');
  menuAbierto = signal(false);

  ngOnInit(): void {
    const datosSesion = localStorage.getItem('usuario');
    if (!datosSesion) {
      this.router.navigate(['/login']);
      return;
    }

    const usuario = JSON.parse(datosSesion);
    this.nombreUsuario.set(`${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim());
    this.rolUsuario.set(usuario.role || '');
    this.cargarModulos(usuario);
  }

  private cargarModulos(usuario: any): void {
    fetch('http://localhost:3000/api/modulos', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}