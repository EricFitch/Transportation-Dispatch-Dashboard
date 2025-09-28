import { JSDOM } from 'jsdom';

console.log('Starting settingsDisplay test...');

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
  url: 'https://localhost/',
  pretendToBeVisual: true
});

const { window } = dom;

// Bridge JSDOM globals
global.window = window;
global.document = window.document;
Object.defineProperty(global, 'navigator', {
  value: window.navigator,
  configurable: true
});
Object.defineProperty(global, 'localStorage', {
  value: window.localStorage,
  configurable: true
});
Object.defineProperty(global, 'sessionStorage', {
  value: window.sessionStorage,
  configurable: true
});
global.CustomEvent = window.CustomEvent;
global.Event = window.Event;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.performance = window.performance;

if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = window.requestAnimationFrame.bind(window);
}
if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
}

// Provide basic stubs expected by the app
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
}

global.matchMedia = window.matchMedia.bind(window);

// Ensure DOM is ready
window.document.body.innerHTML = '<div id="app-root"></div>';

const { uiSystem } = await import('../src/modules/ui/system.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Seed existing preferences to verify they populate the form
const seedPreferences = {
  theme: 'auto',
  density: 'compact',
  layout: 'cards',
  colors: {
    available: '#4CAF50'
  }
};

localStorage.setItem('dispatch_ui_preferences', JSON.stringify(seedPreferences));

uiSystem.openSettings();

const settingsModal = document.getElementById('settings-modal');
assert(settingsModal, 'Settings modal should render in the DOM.');

const themeSelect = document.getElementById('theme-select');
const densitySelect = document.getElementById('density-select');
const layoutSelect = document.getElementById('panel-layout');

assert(themeSelect && densitySelect && layoutSelect, 'Display option selects must be present.');

// Verify seeded values are reflected in the UI controls
assert(themeSelect.value === seedPreferences.theme, 'Theme select should reflect stored preference.');
assert(densitySelect.value === seedPreferences.density, 'Density select should reflect stored preference.');
assert(layoutSelect.value === seedPreferences.layout, 'Layout select should reflect stored preference.');

// Simulate user changes
const newSettings = {
  theme: 'dark',
  density: 'comfortable',
  layout: 'list'
};

themeSelect.value = newSettings.theme;
densitySelect.value = newSettings.density;
layoutSelect.value = newSettings.layout;

uiSystem.saveSettings();

// Ensure modal closed
assert(!uiSystem.isModalOpen(), 'Settings modal should close after saving.');

// Validate attributes applied to document root
assert(document.documentElement.getAttribute('data-theme') === newSettings.theme, 'Theme data attribute should update.');
assert(document.documentElement.getAttribute('data-density') === newSettings.density, 'Density data attribute should update.');
assert(document.documentElement.getAttribute('data-layout') === newSettings.layout, 'Layout data attribute should update.');

const storedPreferences = JSON.parse(localStorage.getItem('dispatch_ui_preferences'));
assert(storedPreferences.theme === newSettings.theme, 'Stored preferences should include updated theme.');
assert(storedPreferences.density === newSettings.density, 'Stored preferences should include updated density.');
assert(storedPreferences.layout === newSettings.layout, 'Stored preferences should include updated layout.');

console.log('✅ Settings display options passed all tests.');
