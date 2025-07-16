# Medical Website Backend

Backend API for medical website with admin CMS functionality.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory with:

   ```
   DATABASE_URL=your_supabase_direct_connection_string
   JWT_SECRET=your_jwt_secret_key_here
   PORT=3000
   ```

3. **Get Database Connection String:**

   - Go to your Supabase project dashboard
   - Navigate to Settings → Database
   - Copy the Connection string (URI format)
   - It should look like: `postgresql://postgres:[password]@[host]:[port]/postgres`

4. **Run the server:**

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### Admin Routes

- `POST /admin/admins` - Create a new admin user

### Example Usage

```bash
# Create admin
curl -X POST http://localhost:3000/admin/admins \
  -H "Content-Type: application/json" \
  -d '{"username": "admin1", "password": "securepass123"}'
```

## Database Tables

### admins

- id (bigint, primary key)
- username (text, unique)
- password (text, hashed)
- created_at (timestamptz)

### countries

- id (bigint, primary key)
- name (text, unique)
- flag_image (text)
- body (text, HTML content)
- created_at (timestamptz)
- updated_at (timestamptz)
