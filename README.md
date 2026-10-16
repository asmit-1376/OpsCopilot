# OpsCopilot

Institute Operations Copilot built for PS1 of the TechSummitTrainers Open Track.

## Project structure

- `ai-backend/` - FastAPI service for AI and operations API logic.
- `frontend/` - Next.js app with role routes under `app/` and Prisma schema/migrations under `prisma/`.
- `compose.yaml` - Local PostgreSQL database service (`localhostdb`).

## Local development

Start PostgreSQL from the project root:

```powershell
docker compose up -d
```

Start the frontend from `frontend/`:

```powershell
npm install
npm run dev
```

Prisma commands, run from `frontend/`:

```powershell
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

Start the FastAPI service from `ai-backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

The API health endpoint is `http://localhost:8000/health`. The local database URL is configured in `frontend/.env`; do not commit environment files.
