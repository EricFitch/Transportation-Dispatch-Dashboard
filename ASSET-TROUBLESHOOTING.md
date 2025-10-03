# Asset Assignment Troubleshooting Guide

## Issue: Assets Not Showing in Route Card Assignment Modal

### Diagnostic Steps

1. **Open debug-assets.html in your browser**
   - Click "Check Assets in LocalStorage"
   - This shows exactly what assets are stored
   - If empty, assets aren't being saved

2. **Check Browser Console Logs**
   When you click "Click to assign" on a route card, you should see:
   ```
   🚛 Assigning asset to route: route-xyz
   📊 STATE.data.assets: [array of assets]
   📊 Assets count: X
   🔍 getAvailableAssets called
   📊 Total assets in system: X
   📊 Assigned assets: [...]
   🔍 Asset BUS-123: assigned=false, down=false, dynamicDown=false, trailer=false
   ✅ Available assets: [array of available assets]
   ```

### Common Issues

#### Issue 1: No Assets in System (0 assets)
**Symptoms:**
- Console shows: `📊 Assets count: 0`
- Modal shows: "No assets in the system"

**Solution:**
1. Click **Fleet Management** button in hamburger menu (⚙️ settings)
   OR
2. Click **Fleet Details** button in Resource Monitor
3. Click **Add Asset** button (blue button in top-right)
4. Fill in the form:
   - Vehicle Number: Required (e.g., "052", "Bus-123")
   - Maximum Capacity: Optional (e.g., 77)
   - Type: Bus/Van/Car/Suburban/Other
   - Status: Active/Maintenance/Retired
5. Click **Add Asset** button in the modal
6. Asset should appear in "Current Assets" list
7. Go back to dashboard and try assigning again

#### Issue 2: Assets Exist But Modal Won't Open
**Symptoms:**
- Console shows assets exist: `📊 Assets count: 5`
- But modal doesn't open
- Or modal is completely broken

**Solution:**
1. Check if Asset Management modal is properly loaded
2. Open browser console
3. Type: `document.getElementById('asset-management-modal')`
4. Should return an HTML element, not null
5. If null, the modal HTML is missing - need to refresh/redeploy

#### Issue 3: Assets Exist But Show "No Available Assets"
**Symptoms:**
- Console shows: `📊 Total assets in system: 5`
- Console shows: `✅ Available assets: []` (empty array)
- Modal shows: "No available assets"

**Reasons:**
- All assets are already assigned to other routes
- Assets are marked as "down" or "maintenance"
- Assets are configured as trailers (trailers have separate assignment)

**Solution:**
1. Check the detailed per-asset logs:
   ```
   🔍 Asset BUS-123: assigned=true, down=false, dynamicDown=false, trailer=false
   ```
2. If `assigned=true`: Unassign from other routes using 🗑️ buttons
3. If `down=true` or `dynamicDown=true`: Change status in Fleet Management
4. If `trailer=true`: This asset is for trailer assignment, not regular assets

#### Issue 4: Form Submits But Assets Don't Save
**Symptoms:**
- Fill in asset form and click "Add Asset"
- No error shown
- Asset doesn't appear in list
- Console may show errors

**Solution:**
1. Open browser console
2. Look for errors like:
   - `❌ addAsset is not a function`
   - `❌ STATE.data is undefined`
   - `❌ Cannot save to localStorage`
3. Clear browser cache: Ctrl+Shift+Delete
4. Hard refresh: Ctrl+F5
5. Try again

#### Issue 5: Assets Save But Don't Persist After Refresh
**Symptoms:**
- Add assets successfully
- Assets show in list
- Refresh page
- Assets are gone

**Solution:**
1. Check localStorage:
   - Open debug-assets.html
   - Click "Check Assets in LocalStorage"
   - Should show your assets
2. If empty after adding:
   - `saveToLocalStorage()` might not be working
   - Check console for errors
   - May need to check browser storage settings
3. Try adding a test asset using debug tool:
   - Open debug-assets.html
   - Click "Add Test Asset"
   - Refresh debug-assets.html
   - Click "Check Assets in LocalStorage"
   - If test asset persists, the save function works

### Debug Commands

Open browser console and run:

```javascript
// Check current assets
console.log('Assets:', STATE.data.assets);

// Check if addAsset function exists
console.log('addAsset function:', typeof addAsset);

// Manually add a test asset
addAsset({ name: 'TEST-BUS', type: 'Bus', capacity: 50, status: 'active' });

// Check available assets
console.log('Available:', getAvailableAssets());

// Force refresh displays
renderAssetPanel();
renderRouteCards();
```

### Files Involved

1. **index.html** - Asset Management Modal (lines ~1082-1212)
2. **src/modules/dispatch/assets.js** - Asset rendering & form handlers
3. **src/modules/core/state.js** - addAsset(), saveToLocalStorage()
4. **src/modules/dispatch/routeCards.js** - getAvailableAssets(), handleAssignAsset()

### Recent Changes

✅ Uncommented Asset Management modal
✅ Added asset form submission handler
✅ Added refreshAssetListModal() function
✅ Added deleteAssetFromModal() function
✅ Imported addAsset from state.js
✅ Added detailed console logging

### Next Steps

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+F5)
3. **Open Fleet Management** and add an asset
4. **Check console logs** for the detailed diagnostic output
5. **Try assigning** the asset to a route
6. **Report** which specific log messages you see

The detailed console logs will pinpoint exactly where the issue is occurring!
