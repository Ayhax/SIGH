import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; // Necesario para navegar al dashboard

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  private router = inject(Router); // Inyectamos el enrutador
  
  usuario: string = '';
  contrasena: string = '';
  errorMsg: string = '';

  onLogin(): void {
    const datosLogin = { username: this.usuario, password: this.contrasena };

    fetch('http://localhost:3000/api/login', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosLogin)
    })
    .then(response => {
      if (!response.ok) throw new Error('Credenciales incorrectas');
      return response.json();
    })
    // En tu método de login, dentro del .then() que recibe la respuesta:
.then(data => {
  // 1. Guardamos el objeto completo del usuario
  localStorage.setItem('usuario', JSON.stringify(data));
  
  // 2. CORRECCIÓN: Guardamos el token en su propia llave explícita
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  
  this.router.navigate(['/dashboard']);
})
    .catch(error => {
      this.errorMsg = 'Error: ' + error.message;
    });
  }
}