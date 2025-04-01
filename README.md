<<<<<<< HEAD
# Hunyuan Forge

A Next.js application for training Hunyuan video models with a beautiful UI and efficient file upload system.

## Features

- Beautiful UI with dynamic video backgrounds
- Efficient multi-file upload system with progress tracking
- Integration with Hugging Face for model training
- Real-time progress tracking and status updates
- Responsive design for all screen sizes

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Clerk Authentication
- React Hooks

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/hunyuan-forge.git
cd hunyuan-forge
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env.local` file with:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
```

4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Environment Variables

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk authentication public key
- `CLERK_SECRET_KEY`: Clerk authentication secret key

## API Endpoints

### POST /api/upload
Handles individual file uploads with progress tracking.

### POST /api/train
Processes the training request with:
- Trigger word
- Hugging Face token
- Multiple training files

## License

MIT
=======
# HunyuanForge
>>>>>>> 9e97e39e596f5130b26c250a0fd4e052b4feab10
