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

### Admin Routes (Protected - require JWT token)

- `POST /admin/admins` - Create a new admin user
- `POST /admin/signin` - Admin signin (get JWT token)
- `POST /admin/countries` - Add a new country

### Public Routes

- `GET /countries` - Get all countries
- `GET /countries/:id` - Get country by ID

### Example Usage

```bash
# Create admin
curl -X POST http://localhost:3000/admin/admins \
  -H "Content-Type: application/json" \
  -d '{"username": "admin1", "password": "securepass123"}'

# Signin admin
curl -X POST http://localhost:3000/admin/signin \
  -H "Content-Type: application/json" \
  -d '{"username": "admin1", "password": "securepass123"}'

# Add country (requires token)
curl -X POST http://localhost:3000/admin/countries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name": "India", "flag_image": "https://example.com/india-flag.png", "body": "<h1>India</h1><p>Country description...</p>"}'

# Get all countries
curl http://localhost:3000/countries

# Get country by ID
curl http://localhost:3000/countries/1
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
