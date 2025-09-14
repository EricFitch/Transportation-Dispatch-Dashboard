// =============================================================================
// SEARCH SYSTEM MODULE
// =============================================================================
// Advanced search functionality for routes, staff, assets, and general content
// Supports quick search overlay, filters, and real-time results

export class SearchSystem {
  constructor() {
    this.searchIndex = new Map();
    this.searchHistory = [];
    this.maxHistoryItems = 50;
    this.searchFilters = {
      type: 'all', // 'routes', 'staff', 'assets', 'all'
      status: 'all',
      assigned: 'all'
    };
    
    this.overlay = null;
    this.searchInput = null;
    this.searchResults = null;
    this.initialized = false;
  }
  
  init() {
    if (this.initialized) return;
    
    this.buildSearchIndex();
    this.initializeSearchUI();
    this.initialized = true;
    
    // Listen for data changes to rebuild index
    window.addEventListener('stateChanged', () => {
      this.rebuildSearchIndex();
    });
    
    console.log('🔍 Search System initialized');
  }
  
  // --- SEARCH INDEX ---
  
  buildSearchIndex() {
    this.searchIndex.clear();
    
    // Index routes
    const routes = window.STATE?.data?.routes || [];
    routes.forEach(route => {
      this.addToIndex('route', route.name, {
        name: route.name,
        type: 'route',
        status: route.status || 'available',
        assigned: route.assigned || null,
        searchText: this.createSearchText(route)
      });
    });
    
    // Index staff
    const staff = window.STATE?.data?.staff || [];
    staff.forEach(member => {
      this.addToIndex('staff', member.name, {
        name: member.name,
        type: 'staff',
        status: member.status || 'available',
        role: member.role || 'driver',
        searchText: this.createSearchText(member)
      });
    });
    
    // Index assets
    const assets = window.STATE?.data?.assets || [];
    assets.forEach(asset => {
      this.addToIndex('asset', asset.name, {
        name: asset.name,
        type: 'asset',
        status: asset.status || 'available',
        searchText: this.createSearchText(asset)
      });
    });
    
    console.log(`📋 Search index built: ${this.searchIndex.size} items`);
  }
  
  rebuildSearchIndex() {
    this.buildSearchIndex();
  }
  
  addToIndex(type, key, data) {
    const indexKey = `${type}:${key}`;
    this.searchIndex.set(indexKey, data);
  }
  
  createSearchText(item) {
    const parts = [];
    
    // Add all string properties
    Object.values(item).forEach(value => {
      if (typeof value === 'string') {
        parts.push(value.toLowerCase());
      }
    });
    
    return parts.join(' ');
  }
  
  // --- SEARCH OPERATIONS ---
  
  search(query, filters = {}) {
    if (!query || query.trim().length < 1) {
      return [];
    }
    
    const searchTerms = query.toLowerCase().split(/\s+/);
    const results = [];
    
    // Apply filters
    const typeFilter = filters.type || this.searchFilters.type;
    const statusFilter = filters.status || this.searchFilters.status;
    const assignedFilter = filters.assigned || this.searchFilters.assigned;
    
    for (const [key, item] of this.searchIndex) {
      // Apply type filter
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        continue;
      }
      
      // Apply status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        continue;
      }
      
      // Apply assigned filter
      if (assignedFilter !== 'all') {
        const isAssigned = item.assigned !== null && item.assigned !== '';
        if (assignedFilter === 'assigned' && !isAssigned) continue;
        if (assignedFilter === 'unassigned' && isAssigned) continue;
      }
      
      // Check if all search terms match
      const matchesAll = searchTerms.every(term => 
        item.searchText.includes(term)
      );
      
      if (matchesAll) {
        results.push({
          ...item,
          relevance: this.calculateRelevance(item, searchTerms)
        });
      }
    }
    
    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    return results.slice(0, 20); // Limit to top 20 results
  }
  
  calculateRelevance(item, searchTerms) {
    let score = 0;
    
    // Higher score for exact matches in name
    if (searchTerms.some(term => item.name.toLowerCase().includes(term))) {
      score += 10;
    }
    
    // Score based on how many terms match
    score += searchTerms.length * 2;
    
    // Boost based on item type priority
    const typePriority = { route: 3, staff: 2, asset: 1 };
    score += typePriority[item.type] || 0;
    
    return score;
  }
  
  // --- UI MANAGEMENT ---
  
  initializeSearchUI() {
    this.overlay = document.getElementById('search-overlay');
    this.searchInput = document.getElementById('overlay-search-input');
    this.searchResults = document.getElementById('search-results');
    
    if (!this.overlay || !this.searchInput || !this.searchResults) {
      console.warn('⚠️ Search UI elements not found, skipping search initialization');
      return;
    }
    
    // Bind events
    this.searchInput.addEventListener('input', this.handleSearchInput.bind(this));
    this.searchInput.addEventListener('keydown', this.handleSearchKeydown.bind(this));
    
    // Close button
    const closeButton = this.overlay.querySelector('.search-close');
    if (closeButton) {
      closeButton.addEventListener('click', this.closeSearchOverlay.bind(this));
    }
    
    // Click outside to close
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) {
        this.closeSearchOverlay();
      }
    });
  }
  
  handleSearchInput(event) {
    const query = event.target.value;
    this.performSearch(query);
  }
  
  handleSearchKeydown(event) {
    if (event.key === 'Escape') {
      this.closeSearchOverlay();
    } else if (event.key === 'Enter') {
      const firstResult = this.searchResults.querySelector('.search-result-item');
      if (firstResult) {
        firstResult.click();
      }
    }
  }
  
  performSearch(query) {
    if (!query || query.trim().length === 0) {
      this.displaySearchResults([]);
      return;
    }
    
    const results = this.search(query);
    this.displaySearchResults(results);
    
    // Add to search history
    if (query.trim().length > 0) {
      this.addToHistory(query.trim());
    }
  }
  
  displaySearchResults(results) {
    if (!this.searchResults) return;
    
    if (results.length === 0) {
      this.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
      return;
    }
    
    const html = results.map(result => `
      <div class="search-result-item" data-type="${result.type}" data-name="${result.name}">
        <div class="search-result-icon">${this.getIconForType(result.type)}</div>
        <div class="search-result-content">
          <div class="search-result-name">${result.name}</div>
          <div class="search-result-meta">${result.type} • ${result.status}</div>
        </div>
      </div>
    `).join('');
    
    this.searchResults.innerHTML = html;
    
    // Add click handlers
    this.searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectSearchResult(item.dataset.type, item.dataset.name);
      });
    });
  }
  
  getIconForType(type) {
    const icons = {
      route: '🚌',
      staff: '👤',
      asset: '🚐'
    };
    return icons[type] || '📄';
  }
  
  selectSearchResult(type, name) {
    console.log(`🎯 Selected ${type}: ${name}`);
    
    // Dispatch selection event
    window.dispatchEvent(new CustomEvent('searchResultSelected', {
      detail: { type, name }
    }));
    
    this.closeSearchOverlay();
  }
  
  // --- SEARCH OVERLAY MANAGEMENT ---
  
  openSearchOverlay() {
    if (!this.overlay) return;
    
    this.overlay.classList.remove('hidden');
    
    // Focus on the search input
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.focus();
        this.searchInput.select();
      }
    }, 100);
    
    console.log('🔍 Search overlay opened');
  }
  
  closeSearchOverlay() {
    if (!this.overlay) return;
    
    this.overlay.classList.add('hidden');
    
    // Clear search
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    if (this.searchResults) {
      this.searchResults.innerHTML = '';
    }
    
    console.log('🔍 Search overlay closed');
  }
  
  // --- SEARCH HISTORY ---
  
  addToHistory(query) {
    // Remove if already exists
    const index = this.searchHistory.indexOf(query);
    if (index > -1) {
      this.searchHistory.splice(index, 1);
    }
    
    // Add to beginning
    this.searchHistory.unshift(query);
    
    // Limit history size
    if (this.searchHistory.length > this.maxHistoryItems) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistoryItems);
    }
  }
  
  getSearchHistory() {
    return [...this.searchHistory];
  }
}

// Global instance
export const searchSystem = new SearchSystem();

// Global function for backward compatibility
export function openQuickSearchDialog() {
  searchSystem.openSearchOverlay();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  searchSystem.init();
});

// Export for global access
window.openQuickSearchDialog = openQuickSearchDialog;
