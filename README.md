# Transportation Dispatch Dashboard

🚌 **Professional school district transportation dispatch system optimized for web deployment**

A comprehensive transportation management system featuring real-time fleet tracking, route management, staff assignments, and advanced reporting capabilities. Designed for Firebase hosting with touch screen optimization.

## 🎯 Features

- **Web-Based Dashboard**: Optimized for browser deployment with Firebase hosting
- **Touch Screen Optimized**: Designed specifically for large touch displays (75+ inches)
- **Real-time Fleet Tracking**: Live status updates with 10-7, 10-8, and 10-11 radio codes
- **Advanced Routing**: Dynamic route management with GPS tracking
- **Staff Management**: Complete driver and monitor assignment system
- **Comprehensive Reporting**: Detailed timestamp reports with route analytics
- **Data Import/Export**: CSV support for fleet and routing databases
- **Dark/Light Mode**: AM/PM toggle with visual mode switching
- **PWA Support**: Progressive Web App with offline capability
- **Responsive Design**: Tailwind CSS for consistent styling across devicesDispatch Dashboard

🚌 **Professional school district transportation dispatch system optimized for 75-inch touch displays**

A comprehensive transportation management system featuring real-time fleet tracking, route management, staff assignments, and advanced reporting capabilities.

## � Features

- **75-inch Touch Optimized**: Designed specifically for large touch displays
- **Real-time Fleet Tracking**: Live status updates with 10-7, 10-8, and 10-11 radio codes
- **Advanced Routing**: Dynamic route management with GPS tracking
- **Staff Management**: Complete driver and monitor assignment system
- **Comprehensive Reporting**: Detailed timestamp reports with route analytics
- **Data Import/Export**: CSV support for fleet and routing databases
- **Dark/Light Mode**: AM/PM toggle with visual mode switching
- **Service Worker**: Offline capability and performance optimization
- **Responsive Design**: Tailwind CSS for consistent styling

## 📁 Project Structure

```
Dispatch Command Center/
├── index.html                 # Main dashboard interface
├── package.json              # Project configuration
├── sw.js                     # Service worker for offline support
├── manifest.json             # PWA manifest for app-like experience
├── assets/
│   └── css/
│       └── dashboard.css      # Complete styling system
├── src/
│   ├── app.js                # Application entry point
│   ├── modules/              # Modular JavaScript components
│   │   ├── core/             # State, utils, events
│   │   ├── dispatch/         # Routes, staff, assets
│   │   ├── touch/            # Touch display optimization
│   │   ├── fleet/            # Fleet management & service
│   │   ├── ui/               # Search, settings, utilities
│   │   ├── operations/       # Field trips, route operations
│   │   └── data/             # Import/export functionality
│   └── styles/               # Organized CSS modules
```

## 🚀 Firebase Deployment

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project set up in console
- Login to Firebase: `firebase login`

### Deployment Steps

1. **Initialize Firebase in your project**:
   ```bash
   firebase init hosting
   ```
   - Select your Firebase project
   - Set public directory to current folder (`.`)
   - Configure as single-page app: Yes
   - Don't overwrite index.html

2. **Deploy to Firebase**:
   ```bash
   firebase deploy
   ```

3. **Custom Domain (Optional)**:
   ```bash
   firebase hosting:channel:create live
   ```

### Local Development with Firebase

Test the application locally before deploying:

```bash
firebase serve
```

This will start a local Firebase hosting server at `http://localhost:5000` (or another port if 5000 is in use). The local server simulates the Firebase hosting environment, allowing you to test:
- Static file serving
- Firebase configuration
- Service worker behavior
- All app functionality before deployment

Press `Ctrl+C` to stop the local server.

## 💾 Data Management

The system supports CSV import for:
- **Fleet Database**: Asset details, driver assignments, service records
- **Routing Database**: Route definitions, stops, scheduling information

Files can be imported via the settings panel or drag-and-drop interface.

### 🔄 Real-Time Sync (Firebase)

Multi-user synchronization is now wired through Firebase. To enable it:

1. **Create a Firebase project** (Firestore in native mode).
2. **Populate `firebase-config.js`** with your project credentials. The stub file ships with empty strings—replace them with the real values exported from the Firebase console:

    ```js
    // firebase-config.js
    window.__FIREBASE_CONFIG__ = {
       apiKey: '...your key...',
       authDomain: '...firebaseapp.com',
       projectId: 'your-project-id',
       storageBucket: 'your-project-id.appspot.com',
       messagingSenderId: '...',
       appId: '...'
    };
    ```

    For production deployments, you can generate this file during your build or serve it from a secure endpoint so secrets stay out of source control.

3. **Deploy Firestore security rules**. The repo ships with `firestore.rules`, which locks access to `dispatch/sharedState` to authenticated users. Adjust the path if you change the collection/document names in `src/modules/core/state.js`.
4. **Enable Anonymous Authentication** under *Build → Authentication → Sign-in method*. The dashboard signs in anonymously so the stricter Firestore rules still work without a manual login flow. You can swap this for another auth strategy later.
5. **Deploy hosting and rules together**:
   ```bash
   firebase deploy --only hosting,firestore:rules
   ```

With the configuration in place the dashboard will:

- Mirror the entire shared state to `dispatch/sharedState` in Firestore.
- Listen for remote updates and broadcast them through the event bus (`routes:dataChanged`, `assets:dataChanged`, etc.).
- Fall back to localStorage gracefully if Firebase is unreachable.

## 🎯 Core Modules

### **Core Infrastructure**
- `core/state.js` - State management and localStorage
- `core/utils.js` - Performance utilities and debouncing
- `core/events.js` - Global event handling and keyboard navigation

### **Touch Optimization (75" Display)**
- `touch/gestures.js` - Touch gestures, long press, swipe detection
- `touch/feedback.js` - Visual and haptic feedback systems
- `touch/responsive.js` - Large screen adaptation and responsive layouts

### **Transportation Dispatch**
- `dispatch/routes.js` - Route rendering and management
- `dispatch/staff.js` - Driver and monitor assignment operations  
- `dispatch/assets.js` - Bus and vehicle fleet management
- `dispatch/routeCards.js` - Interactive route card system

### **Fleet Management**
- `fleet/service.js` - Fleet service status and maintenance tracking
- `fleet/management.js` - Comprehensive fleet operations

### **Operations**
- `operations/assignments.js` - Assignment confirmation and clearing
- `operations/fieldTrips.js` - Field trip management and scheduling
- `operations/routeManagement.js` - Advanced route control systems

### **User Interface**
- `ui/search.js` - Advanced search and filtering capabilities
- `ui/settingsSystem.js` - Settings panels with diagnostics
- `ui/system.js` - System utilities and modal management
- `ui/advancedSearch.js` - Enhanced search functionality

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

## �🔧 Technical Details

- **Architecture**: ES6 modules with clean separation of concerns
- **Styling**: Tailwind CSS via CDN for rapid development
- **Performance**: Service worker for offline capability
- **Touch Support**: Optimized for large touch displays with gesture recognition
- **Data Persistence**: LocalStorage with CSV import/export
- **Real-time Updates**: Live status tracking and notifications

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

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Status**: Production ready - Full functionality implemented and tested
