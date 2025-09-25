# Firebase Deployment Guide

## Prerequisites

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Create a Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Create a project"
   - Enter project name (e.g., "dispatch-dashboard")
   - Choose your analytics preferences
   - Click "Create project"

## Setup

1. **Initialize Firebase in your project**:
   ```bash
   firebase init hosting
   ```
   
   When prompted:
   - **Select project**: Choose the project you created above
   - **Public directory**: Press Enter (uses current directory `.`)
   - **Single-page app**: Type `y` and press Enter
   - **Overwrite index.html**: Type `n` and press Enter

2. **Update .firebaserc** with your project ID:
   ```json
   {
     "projects": {
       "default": "your-project-id-here"
     }
   }
   ```

## Deployment

1. **Deploy to Firebase**:
   ```bash
   firebase deploy
   ```

2. **View your deployed app**:
   Your app will be available at: `https://your-project-id.web.app`

## Custom Domain (Optional)

1. **Add custom domain**:
   ```bash
   firebase hosting:channel:create live
   ```

2. **In Firebase Console**:
   - Go to Hosting section
   - Click "Add custom domain"
   - Follow the DNS setup instructions

## File Structure

The following files are essential for Firebase deployment:

### Core Files (Required)
- `index.html` - Main application
- `manifest.json` - PWA manifest
- `sw.js` - Service worker
- `src/` - Application modules
- `assets/` - Static assets

### Firebase Configuration
- `firebase.json` - Firebase hosting configuration
- `.firebaserc` - Project configuration

### Build Files
- `package.json` - Dependencies (for development only)
- `tailwind.config.js` - Tailwind configuration

## Performance Optimization

The `firebase.json` includes:
- **Caching**: Long-term caching for static assets
- **Service Worker**: No-cache for SW updates
- **Compression**: Automatic GZIP compression
- **Rewrites**: SPA routing support

## Development Workflow

1. **Local Development**:
   ```bash
   npm run dev
   ```

2. **Test Before Deploy**:
   ```bash
   firebase serve
   ```

3. **Deploy Changes**:
   ```bash
   firebase deploy
   ```

## Troubleshooting

- **404 errors**: Check that `index.html` is in the root directory
- **Assets not loading**: Verify paths are relative (start with `./`)
- **Service worker issues**: Clear browser cache or check SW registration
- **Deployment fails**: Check Firebase project permissions

## Production Notes

- The app uses CDN Tailwind CSS for rapid development
- LocalStorage is used for data persistence
- Service worker provides offline functionality
- PWA manifest enables app-like installation