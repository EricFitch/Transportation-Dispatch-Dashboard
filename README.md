# Transportation Dispatch Dashboard

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
├── assets/
│   └── css/
│       └── dashboard.css      # Complete styling system
├── src/
│   ├── app.js                # Application entry point
│   ├── modules/              # Modular JavaScript components
│   │   ├── core/             # State, utils, events
│   │   ├── dispatch/         # Routes, staff, assets
│   │   ├── touch/            # 75" display touch optimization
│   │   ├── fleet/            # Fleet management & service
│   │   ├── ui/               # Search, settings, utilities
│   │   ├── operations/       # Field trips, route operations
│   │   └── data/             # Import/export functionality
│   └── styles/               # Organized CSS modules
└── tools/                    # Development and extraction tools
```

## 🛠️ Quick Start

1. **Clone the repository**:
   ```bash
   git clone [repository-url]
   cd "Dispatch Command Center"
   ```

2. **Open in a web server**:
   - Use VS Code Live Server extension, or
   - Run `python -m http.server 8000` or `npx serve`

3. **Access the dashboard**:
   - Open `http://localhost:8000` in your browser
   - For best experience, use a large touch display (75+ inches)

## 💾 Data Management

The system supports CSV import for:
- **Fleet Database**: Asset details, driver assignments, service records
- **Routing Database**: Route definitions, stops, scheduling information

Files can be imported via the settings panel or drag-and-drop interface.

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

## 🔧 Technical Details

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
