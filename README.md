# Aysén Training Store

Aplicación de comercio electrónico para una tienda de equipamiento deportivo. Está construida con Next.js, TypeScript, Turso y Drizzle ORM, y utiliza una identidad visual inspirada en la Patagonia.

## Funcionalidades

- Catálogo con búsqueda, categorías, variantes, ofertas y disponibilidad.
- Carrito y pedidos con pago por transferencia; no incluye pasarela de pagos.
- Alternativas de envío y retiro configurables.
- Cuentas de clientes, direcciones guardadas e historial de pedidos.
- Interfaz privada de administración para gestionar productos, pedidos y contenido de la tienda.
- Editor de portada, historia de marca y pie de página con vista previa.
- Banners promocionales programables y personalizables.
- Generación de tickets imprimibles para preparar pedidos.
- Recuperación de contraseña por correo desactivada inicialmente.

## Desarrollo

Requiere Node.js 20.9 o superior.

```bash
npm install
```

Crea un archivo `.env.local` a partir de `.env.example` y completa las variables necesarias para la base de datos, las sesiones y los servicios externos que quieras usar. No publiques archivos de entorno ni credenciales.

```bash
npm run dev
```

La aplicación crea las tablas necesarias al iniciar. En desarrollo local puede usar SQLite; en producción requiere una base Turso persistente. El catálogo de demostración solo se carga en desarrollo.

## Despliegue

El proyecto está preparado para ejecutarse como aplicación Next.js en Vercel. Conecta el repositorio, configura en el proyecto las variables de entorno necesarias y usa `npm run build` como comando de compilación. Configura una base Turso persistente para cada entorno y una versión de Node.js 20.9 o superior.

Antes de abrir la tienda, revisa los productos, precios, inventario, datos de transferencia, cobertura de entrega y textos legales. El emisor electrónico del SII no está integrado; su panel informativo no emite documentos tributarios.
