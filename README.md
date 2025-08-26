# 🎾 Scrappers Cup - Tennis Ladder System

A Next.js web application for managing a tennis tournament ladder system with poison ladder ranking.

## Features

- **Poison Ladder System**: Winners move up to loser's position, dynamic rankings
- **Email Allowlist Authentication**: Simple email-based access control
- **Admin Panel**: Score entry, player management, and tournament administration
- **Player Profiles**: Detailed match history and statistics for each player
- **Mobile-First Design**: Optimized for phone viewing
- **Real-time Updates**: Automatic ranking updates after each match

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Simple email allowlist with localStorage sessions
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (recommended)

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- A Supabase account
- Git

### 2. Clone and Install

```bash
git clone <your-repo-url>
cd scrappers-cup
npm install
```

### 3. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API and copy your URL and anon key
3. Go to SQL Editor and run the schema from `supabase-schema.sql`

### 4. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Admin Password (server-side only - never exposed to client)
ADMIN_PASSWORD=your_secure_admin_password_here
```

### 5. Database Setup

Run the SQL schema in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of supabase-schema.sql
```

### 6. Configure Email Access

In your Supabase database, add allowed emails to the `allowed_emails` table:

```sql
INSERT INTO allowed_emails (email, is_admin) VALUES 
  ('admin@example.com', true),
  ('player1@example.com', false),
  ('player2@example.com', false);
```

### 7. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your application.

## Usage

### For Players (Viewers)

1. Visit the website and enter your authorized email
2. If your email is on the allowlist, you'll get instant access
3. View the current ladder standings
4. Click on any player to see their match history

### For Admins

1. Enter your admin email address
2. System detects admin access and prompts for password
3. Enter the admin password (set in environment variables)
4. Access the Admin Panel with tabs for:
   - **Enter Match**: Record new match results
   - **Match History**: View, edit, or delete past matches
5. Navigate to **Manage Players** to add/edit players and email access

## Database Schema

### Tables

- **allowed_emails**: Controls who can access the system
- **players**: Tournament participants with ranking information
- **matches**: Match results with set scores and tiebreaker details

### Key Features

- **Row Level Security**: Ensures data access is properly controlled
- **Automatic Timestamps**: Tracks when records are created
- **Foreign Key Constraints**: Maintains data integrity
- **Check Constraints**: Validates data ranges and values

## Poison Ladder Logic

1. When a match is entered, the system determines the winner
2. If the winner has a lower rank number (higher position) than the loser:
   - Winner moves to the loser's position
   - All players between the winner's old position and loser's position move down one rank
3. Rankings are updated automatically in the database
4. Leaderboard reflects changes immediately

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in Vercel settings
4. Deploy automatically

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Customization

### Adding More Game Formats

To support different match formats, modify:
- Database schema in `supabase-schema.sql`
- Match entry form in `components/admin/MatchEntryForm.tsx`
- Ladder logic in `lib/utils/ladder.ts`

### Styling

The app uses Tailwind CSS. Customize colors and styling in:
- `tailwind.config.js`
- Component files
- `app/globals.css`

### Email Templates

Supabase handles email templates. Customize them in:
- Supabase Dashboard > Authentication > Email Templates

## Support

For issues or questions:
1. Check the GitHub issues
2. Review Supabase documentation
3. Check Next.js documentation

## License

MIT License - feel free to use this for your own tennis tournaments!