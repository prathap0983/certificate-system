# Certificate System backend

The original HTML/CSS/JavaScript UI remains in the repository root. Spring Boot serves those files and exposes REST endpoints under `/api`.

## Run

1. Install JDK 25 and Maven 3.9+.
2. Start MySQL and create a user with permission to create/use `certificate_system`, or set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`.
3. Set a strong `JWT_SECRET` (at least 32 characters) and optionally `UPLOAD_DIR`.
4. Run `mvn spring-boot:run`.
5. Open `http://localhost:8080/login.html`.

Development seed account: `admin@samudhratech.com` / `Admin@123`. Change this immediately in a real deployment.

Uploaded PNG/JPG/JPEG/SVG files are validated, stored under `UPLOAD_DIR`, tracked in MySQL, and served at `/uploads/{file}`. Browser local storage only retains the JWT/session UI state; server records are authoritative.

## API

- `POST /api/auth/login`
- `GET|POST /api/templates`, `GET|PUT|DELETE /api/templates/{id}`
- `POST /api/templates/{id}/publish`, `POST /api/templates/{id}/duplicate`
- `POST /api/upload/{logo|seal|signature|background}` (multipart `file`)

All API calls except login and verification require `Authorization: Bearer <jwt>`.
