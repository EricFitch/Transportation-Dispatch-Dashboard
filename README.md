# Transportation Dispatch Dashboard

🚌 **Professional school district transportation dispatch system with Firebase real-time sync**

A comprehensive transportation management system featuring real-time fleet tracking, route management, staff assignments, and advanced reporting capabilities. Deployed on Firebase with multi-device synchronization and touch screen optimization.

**Live Demo**: [https://dispatch-board-12bb8.web.app](https://dispatch-board-12bb8.web.app)

## 🎯 Features

### Core Capabilities
- **Real-Time Firebase Sync**: Multi-device synchronization with instant updates across all connected clients
- **Touch Screen Optimized**: Designed specifically for large touch displays (75+ inches)
- **Live Fleet Tracking**: Real-time status updates with 10-7, 10-8, and 10-11 radio codes
- **Advanced Route Management**: Dynamic routing with GPS tracking and departure sequencing
- **Role-Based Visualization**: Driver roles color-code route cards (Trainer=Red, Driver=Blue, etc.)
- **Collapsible Card View**: Compact route display with expand/collapse functionality
- **Staff Management**: Complete driver and monitor assignment system with dedicated page
- **Fleet Management**: Full asset tracking with parking space indicators and status monitoring
- **Comprehensive Reporting**: Detailed timestamp reports with route analytics
- **Data Import/Export**: CSV support for bulk operations and backups
- **Dark/Light Mode**: AM/PM shift toggle with visual mode switching
- **PWA Support**: Progressive Web App with offline capability
- **Responsive Design**: Tailwind CSS for consistent styling across devices

## 📁 Project Structure

```
Dispatch Command Center/
├── index.html                 # Main dashboard interface
├── staff-details.html         # Staff management page
├── fleet-details.html         # Fleet management page
├── firebase-config.js         # Firebase configuration (embedded in state.js)
├── firebase.json              # Firebase hosting configuration
├── firestore.rules            # Firestore security rules
├── package.json               # Project configuration
├── sw.js                      # Service worker for offline support
├── manifest.json              # PWA manifest for app-like experience
├── assets/
│   ├── css/
│   │   └── dashboard.css      # Complete styling system
│   └── icons/                 # UI icons and graphics
├── src/
│   ├── app.js                 # Application entry point
│   ├── firebase.js            # Firebase initialization
│   ├── modules/               # Modular JavaScript components
│   │   ├── core/              # State management, utils, events, validation
│   │   ├── dispatch/          # Routes, staff, assets, route cards
│   │   ├── touch/             # Touch display optimization & gestures
│   │   ├── fleet/             # Fleet management & service tracking
│   │   ├── ui/                # Search, settings, modals, utilities
│   │   ├── operations/        # Field trips, assignments, bulk operations
│   │   └── data/              # Import/export functionality
│   └── styles/                # Organized CSS modules
│       ├── main.css           # Main stylesheet
│       ├── components/        # Button, modal components
│       ├── dispatch/          # Route card styles
│       ├── touch/             # Touch feedback styles
│       └── ui/                # UI component styles
├── docs/
│   └── archive/               # Historical implementation documentation
└── tests/                     # Test files
```

## 🚀 Firebase Deployment

### Current Deployment
**Live URL**: [https://dispatch-board-12bb8.web.app](https://dispatch-board-12bb8.web.app)  
**Project ID**: dispatch-board-12bb8  
**Branch**: Firebase-Deploy  

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project configured in Firebase Console
- Login to Firebase: `firebase login`

### Quick Deploy

```bash
firebase deploy --only hosting
```

### Full Deployment (Hosting + Firestore Rules)

```bash
firebase deploy --only hosting,firestore:rules
```

### Local Development with Firebase

Test the application locally before deploying:

```bash
firebase serve
```

This starts a local Firebase hosting server at `http://localhost:5000`. The local server simulates the Firebase hosting environment, allowing you to test:
- Static file serving
- Firebase real-time sync
- Service worker behavior
- All app functionality before deployment

Press `Ctrl+C` to stop the local server.

### Initial Setup (Already Completed)

If setting up a new Firebase project:

1. **Initialize Firebase**:
   ```bash
   firebase init hosting
   ```
   - Select your Firebase project
   - Set public directory to current folder (`.`)
   - Configure as single-page app: Yes
   - Don't overwrite existing files

2. **Initialize Firestore**:
   ```bash
   firebase init firestore
   ```
   - Accept default `firestore.rules`
   - Accept default `firestore.indexes.json`

## 💾 Data Management

The system supports CSV import for:
- **Fleet Database**: Asset details, driver assignments, service records
- **Routing Database**: Route definitions, stops, scheduling information

Files can be imported via the settings panel or drag-and-drop interface.

### 🔄 Real-Time Sync (Firebase)

Multi-device synchronization is **automatically enabled** through Firebase Firestore. The Firebase configuration is embedded directly in `src/modules/core/state.js` for reliable initialization.

#### How It Works

- **Automatic Sync**: All route, staff, and fleet changes sync immediately to Firestore (`dispatch/sharedState`)
- **Multi-Device**: Changes on one device appear instantly on all connected devices
- **Event-Driven**: Updates broadcast through the event bus (`routes:dataChanged`, `assets:dataChanged`, `staff:updated`)
- **Fallback**: Gracefully falls back to localStorage if Firebase is unreachable
- **Zero Config**: No manual configuration needed - works out of the box

#### For New Firebase Projects

If you're setting up a new Firebase project:

1. **Create a Firebase project** in the [Firebase Console](https://console.firebase.google.com/) (Firestore in native mode)

2. **Update Firebase config** in `src/modules/core/state.js`:
   ```javascript
   const EMBEDDED_FIREBASE_CONFIG = {
       apiKey: 'your-api-key',
       authDomain: 'your-project.firebaseapp.com',
       projectId: 'your-project-id',
       storageBucket: 'your-project.appspot.com',
       messagingSenderId: 'your-sender-id',
       appId: 'your-app-id',
       measurementId: 'your-measurement-id'
   };
   ```

3. **Enable Anonymous Authentication**:
   - Navigate to *Build → Authentication → Sign-in method*
   - Enable "Anonymous" provider
   - This allows the app to write to Firestore without manual login

4. **Deploy Firestore rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

The included `firestore.rules` file provides secure access to the `dispatch/sharedState` document for authenticated users.

## 🎯 Core Modules

### **Core Infrastructure**
- `core/state.js` - State management, Firebase sync, and localStorage with embedded Firebase config
- `core/utils.js` - Performance utilities and debouncing
- `core/events.js` - Global event bus and keyboard navigation
- `core/validationService.js` - Data validation and error handling
- `firebase.js` - Firebase SDK initialization

### **Touch Optimization (75" Display)**
- `touch/gestures.js` - Touch gestures, long press, swipe detection
- `touch/feedback.js` - Visual and haptic feedback systems
- `touch/responsive.js` - Large screen adaptation and responsive layouts
- `touch/controller.js` - Touch event coordination

### **Transportation Dispatch**
- `dispatch/routes.js` - Route rendering and management
- `dispatch/staff.js` - Driver and monitor assignment operations with immediate Firebase sync
- `dispatch/assets.js` - Bus and vehicle fleet management with parking space tracking
- `dispatch/routeCards.js` - Interactive route card system with collapse/expand and role-based colors

### **Fleet Management**
- `fleet/service.js` - Fleet service status and maintenance tracking
- `fleet/management.js` - Comprehensive fleet operations
- **fleet-details.html** - Dedicated fleet management page with full asset CRUD operations

### **Staff Management**
- **staff-details.html** - Dedicated staff management page with role assignments
- Role-based color coding (Driver=Blue, Trainer=Red, Mechanic=Orange, etc.)
- CSV import/export for bulk operations
- Real-time sync across all pages

### **Operations**
- `operations/assignments.js` - Assignment confirmation and clearing
- `operations/fieldTrips.js` - Field trip management and scheduling
- `operations/routeManagement.js` - Advanced route control systems
- `operations/bulk.js` - Bulk operations for efficiency

### **User Interface**
- `ui/search.js` - Advanced search and filtering capabilities
- `ui/settingsSystem.js` - Settings panels with diagnostics
- `ui/system.js` - System utilities and modal management
- `ui/advancedSearch.js` - Enhanced search functionality
- `ui/modalService.js` - Modal dialog management
- `ui/cardManagement.js` - Route card interaction handlers

### **Data Management**
- `data/importExport.js` - CSV import/export and data synchronization

## �️ UI Controls & Event Wiring Overview

The dispatcher interface uses explicit element IDs, delegated listeners, and shared module exports to keep behavior predictable across the dashboard. The latest audit cross-referenced every visible control with its handler to confirm coverage and surface any remaining follow-ups.

### Main Dashboard (`index.html`)
- `#hamburger-menu-btn` &mdash; Wired in `src/app.js` with a fallback to `settingsSystem` so the settings slide-out opens even if initialization order changes.
- `#search-toggle-btn` &mdash; Opens the floating search overlay and gracefully no-ops if the search system has not finished booting.
- `#reset-board-btn` &mdash; Prompts for confirmation and calls `window.resetRouteBoard`, guaranteeing a full board reset when accepted.
- `#timestamp-report-btn` &mdash; Launches the timestamp report modal and reuses shared modal handlers for printing and clearing.
- `#am-toggle` / `#pm-toggle` &mdash; Switches the view via `switchToView`, re-renders route cards, and emits `view:changed` through the event bus.
- Slide-out menu shortcuts (`#open-comprehensive-settings`, `#open-route-management`, `#open-asset-management`, `#open-staff-management`, `#export-all-data`, `#import-data`, `#open-search-dialog`) &mdash; Each control routes through `app.js` to open the corresponding modal or settings workflow.
- `#staff-details-btn` / `#fleet-details-btn` &mdash; Provide quick navigation to dedicated management pages while closing the slide-out for a clean transition.

### Fleet Details (`fleet-details.html`)
- `history.back()` back button &mdash; Uses native navigation so operators can quickly return to the dashboard.
- `exportFleetData()` and `addNewAsset()` &mdash; Exposed as globals from `src/modules/fleet/fleet-management.js`, giving immediate access to export and asset-creation workflows.
- Filter controls (`#fleet-search`, `#type-filter`, `#status-filter`) &mdash; Debounced listeners apply filters without refreshing the page; `resetFilters()` restores defaults.
- `closeAssetModal()` &mdash; Global helper that hides the modal while keeping content intact for the next launch.

### Staff Details (`staff-details.html`)
- `history.back()` back button mirrors dashboard behavior for consistency.
- `#export-staff-data` &mdash; Prefers `window.exportStaffListAsCSV`, then falls back to on-the-fly CSV generation if the module is still loading.
- `#add-staff-btn` &mdash; Scrolls to the creation form or emits `staff:showAddForm` when the modal lives elsewhere.
- Search and filter inputs (`#staff-search`, `#role-filter`, `#status-filter`, `#reset-filters`) &mdash; Apply live filtering through `renderStaffDetailsPage` with graceful degradation.
- `closeStaffModal()` &mdash; Referenced in markup; ensure the helper is exported (see follow-ups below).

### Module Wiring Highlights
- Core modules (`core/state`, `core/utils`, `core/events`) initialize before UI layers, guaranteeing shared helpers (event bus, debouncers, storage access) are ready for downstream modules.
- UI singletons (`ui/system`, `ui/settingsSystem`, `ui/advancedSearch`) register their own delegated listeners and expose entry points via `window` for cross-module reuse.
- Dispatch modules (`dispatch/routes`, `dispatch/routeCards`, `dispatch/staff`, `dispatch/assets`) expose renderers and assignment helpers that `src/app.js` re-exports globally for modals, bulk actions, and diagnostics.
- Fleet and operations managers (`fleet/management`, `operations/assignments`, `operations/routeManagement`) subscribe to event bus topics to stay synchronized with asset and route changes.

### Follow-up Recommendations
- Export `window.closeStaffModal` from `dispatch/staff.js` so the staff details modal matches the fleet modal behavior.
- Complete the placeholder implementations for `window.exportFleetData` and `window.addNewAsset` to provide inline functionality from Fleet Details.
- When extending the UI, continue using delegated listeners and module exports so new controls remain testable and maintainable.

## 🔧 Technical Details

- **Architecture**: ES6 modules with clean separation of concerns
- **Database**: Firebase Firestore for real-time multi-device synchronization
- **State Management**: Embedded Firebase config in state.js for reliable initialization
- **Styling**: Tailwind CSS via CDN for rapid development and responsive design
- **Performance**: Service worker for offline capability and caching
- **Touch Support**: Optimized for 75+ inch touch displays with gesture recognition
- **Data Persistence**: Dual-layer persistence (Firebase primary, localStorage fallback)
- **Real-time Updates**: Live status tracking with instant cross-device synchronization
- **PWA**: Progressive Web App with manifest and service worker
- **Hosting**: Firebase Hosting with global CDN

## � Reporting Features

- **Timestamp Reports**: Comprehensive route analysis with driver and asset details
- **Status Tracking**: Real-time 10-7, 10-8, 10-11 radio code monitoring  
- **Safety Records**: Escort tracking and safety note management
- **System Diagnostics**: Advanced logging and health monitoring

## 🛡️ System Requirements

- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge
- **Screen Size**: Optimized for 75+ inch displays
- **Touch Support**: Multi-touch capability recommended
- **Network**: Online for full functionality, offline mode available

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🎨 Recent Features

### Role-Based Color Coding
Route cards display colors based on the assigned driver's role:
- **Driver** → Blue (#3b82f6)
- **Utility Driver** → Gray (#6b7280)
- **Safety Escort** → Purple (#8b5cf6)
- **Mechanic** → Orange (#f59e0b)
- **Trainer** → Red (#ef4444)
- **Office Staff** → Green (#10b981)

### Collapsible Route Cards
- Clean, compact view when collapsed
- Route number displays in driver's role color
- One-click expand/collapse
- Shows driver, vehicle, and key info at a glance
- "Collapse All" button for quick board overview

### Immediate Firebase Sync
- Staff role changes sync instantly to Firebase
- Fleet status updates propagate to all devices
- No data loss when navigating between pages
- Embedded Firebase config ensures sync works on all pages

### Parking Space Indicators
- Visual parking space badges on route cards
- Parking icons in fleet management
- Easy vehicle location tracking

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Status**: ✅ Production Ready - Deployed to Firebase  
**Last Updated**: October 3, 2025  
**Version**: 2.0 (Firebase Real-Time Sync)  
**Live URL**: https://dispatch-board-12bb8.web.app
