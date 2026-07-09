import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  private router = inject(Router);
  private authService = inject(AuthService);

  usuario: string = '';
  contrasena: string = '';
  errorMsg: string = '';
  cargando: boolean = false;

  async onLogin(): Promise<void> {
    this.errorMsg = '';

    if (!this.usuario.trim() || !this.contrasena.trim()) {
      this.errorMsg = 'Por favor, ingresa tu usuario y contraseña.';
      return;
    }

    this.cargando = true;
    const resultado = await this.authService.login(this.usuario, this.contrasena);
    this.cargando = false;

    if (resultado.ok) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMsg = resultado.mensaje || 'Error al iniciar sesión.';
    }
  }
}