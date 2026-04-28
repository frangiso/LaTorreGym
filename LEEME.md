# La Torre Gym — Setup

## 1. Crear repo en GitHub
Nombre sugerido: `latorre-gym`

## 2. Subir todos los archivos a GitHub

Estructura de carpetas:
```
latorre-gym/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── firebase.js
    ├── seedFirestore.js
    ├── context/
    │   └── AuthContext.jsx
    ├── components/
    │   ├── LtLayout.jsx
    │   └── LtHeader.jsx
    └── pages/
        ├── Login.jsx
        ├── Register.jsx
        ├── InstructivoPlanes.jsx
        ├── PagoInstructivo.jsx
        ├── EsperaAprobacion.jsx
        ├── alumno/
        │   └── PanelAlumno.jsx
        └── profe/
            ├── PanelProfe.jsx
            ├── GrillaSemanal.jsx
            ├── PanelAlumnos.jsx
            ├── PagosPendientes.jsx
            └── ConfigGimnasio.jsx
```

## 3. Configurar Firebase

### Habilitar Authentication
- Firebase Console → Authentication → Sign-in method → Email/Password → Habilitar

### Crear usuario del profe manualmente
- Firebase Console → Authentication → Agregar usuario
- Email: (el del profe), Password: (a elección)
- Luego en Firestore → Colección `usuarios` → Documento con el UID del profe:
```json
{
  "nombre": "Profe",
  "apellido": "Torre",
  "email": "profe@latorre.com",
  "rol": "profe",
  "estado": "activo"
}
```

### Cargar config inicial (una sola vez)
- Agregar en `src/main.jsx` temporalmente:
```js
import { seedGimnasio, seedSlots } from "./seedFirestore";
seedGimnasio();
seedSlots();
```
- Hacer un deploy, abrir la app, esperar los logs en consola.
- Luego quitar esas líneas y volver a hacer deploy.

### Reglas de Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid} {
      allow read, write: if request.auth.uid == uid;
      allow read, write: if get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == "profe";
    }
    match /config/{doc} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == "profe";
    }
    match /slots/{doc} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == "profe";
    }
    match /reservas/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.alumnoId;
    }
    match /feriados/{doc} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == "profe";
    }
  }
}
```

## 4. Deployar en Vercel
- Conectar repo de GitHub en Vercel
- Framework: Vite
- Build command: `npm run build`
- Output dir: `dist`
- Deploy

## 5. Completar luego
- WhatsApp del gimnasio: desde panel del profe → Config
- Ajustar reglamento: desde panel del profe → Config
- Ajustar planes/precios: desde panel del profe → Config
