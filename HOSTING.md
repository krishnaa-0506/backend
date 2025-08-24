# Robo Ride Backend

This backend is ready for deployment on Vercel. Sensitive environment variables are not committed—see `.env.example` for required variables.

## Steps to Host on GitHub and Vercel

1. **Initialize Git and Push to GitHub**
   - Run these commands in the `backend` folder:
     ```sh
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin <your-github-repo-url>
     git push -u origin main
     ```

2. **Set up Environment Variables on Vercel**
   - In Vercel dashboard, add the environment variables from `.env.example` (do NOT upload `.env`).
   - Example:
     - `MONGO_URI=your_mongodb_connection_string`
     - `PORT=4000`

3. **Deploy on Vercel**
   - Import your GitHub repo in Vercel.
   - Set build command: `npm install`
   - Set output directory: leave blank (for API/serverless)
   - Set start command: `npm start` (or use Vercel's default for Node.js API)

4. **Privacy & Security**
   - `.env` is gitignored and never committed.
   - Only share `.env.example` for reference.
   - Never expose secrets in code or public repos.

---

For any issues, check Vercel logs or ask for help.
