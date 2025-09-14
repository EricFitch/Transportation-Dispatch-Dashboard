/**
 * ADVANCED SEARCH SYSTEM MODULE
 * Transportation Dispatch Dashboard
 * 
 * Comprehensive search functionality including:
 * - Fuzzy search with scoring
 * - Saved searches and bookmarks
 * - Advanced filtering and faceted search
 * - Search analytics and history
 * - Real-time search suggestions
 * - Complex query parsing
 * - Search result highlighting
 * 
 * Dependencies: core/events, core/state, ui/system
 */

import { eventBus } from '../core/events.js';
import { STATE, getState, setState, saveToLocalStorage } from '../core/state.js';
import { uiSystem } from './system.js';

class AdvancedSearchSystem {
  constructor() {
    this.searchIndex = new Map();
    this.searchHistory = [];
    this.savedSearches = [];
    this.searchAnalytics = {
      totalSearches: 0,
      topQueries: new Map(),
      searchTimes: [],
      resultCounts: []
    };
    
    this.searchFilters = {
      global: '',
      staff: '',
      routes: '',
      assets: '',
      timeRange: { from: '', to: '' },
      options: {
        fuzzySearch: true,
        caseSensitive: false,
        wholeWords: false,
        searchNotes: true,
        searchAssignments: true,
        includeTimestamps: false
      }
    };

    this.overlay = null;
    this.searchInput = null;
    this.searchResults = null;
    this.initialized = false;
    this.currentResults = [];
    this.maxResults = 50;
    this.searchTimeout = null;
    this.minQueryLength = 2;
  }

  /**
   * Initialize advanced search system
   */
  init() {
    if (this.initialized) {
      console.log('🔍 Advanced Search System already initialized');
      return;
    }

    this.loadSearchData();
    this.buildSearchIndex();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.connectExistingUI();
    
    this.initialized = true;
    console.log('🔍 Advanced Search System initialized');
  }

  /**
   * Load saved search data
   */
  loadSearchData() {
    try {
      const savedData = getState('searchSystem');
      if (savedData) {
        this.searchHistory = savedData.history || [];
        this.savedSearches = savedData.savedSearches || [];
        this.searchAnalytics = { ...this.searchAnalytics, ...savedData.analytics };
        this.searchFilters.options = { ...this.searchFilters.options, ...savedData.options };
      }
    } catch (error) {
      console.error('❌ Error loading search data:', error);
    }
  }

  /**
   * Save search data
   */
  saveSearchData() {
    try {
      setState('searchSystem', {
        history: this.searchHistory.slice(0, 50), // Limit history size
        savedSearches: this.savedSearches.slice(0, 20), // Limit saved searches
        analytics: this.searchAnalytics,
        options: this.searchFilters.options
      });
    } catch (error) {
      console.error('❌ Error saving search data:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    eventBus.on('data:updated', () => {
      this.rebuildSearchIndex();
    });

    eventBus.on('search:query', (data) => {
      this.performSearch(data.query, data.filters);
    });

    eventBus.on('search:save', (data) => {
      this.saveSearch(data.name, data.query, data.filters);
    });

    eventBus.on('search:clear', () => {
      this.clearSearchResults();
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+F or Cmd+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.openAdvancedSearchDialog();
      }
      
      // Ctrl+Shift+F for advanced search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.openAdvancedSearchDialog(true);
      }
      
      // Escape to close search
      if (e.key === 'Escape' && this.isSearchOpen()) {
        this.closeSearchOverlay();
      }
    });
  }

  /**
   * Connect to existing UI elements
   */
  connectExistingUI() {
    // Connect the existing search button in header
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    if (searchToggleBtn) {
      searchToggleBtn.addEventListener('click', () => {
        this.openAdvancedSearchDialog();
      });
    }

    // Connect the main search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const globalSearch = document.getElementById('global-search');
        const query = globalSearch ? globalSearch.value : '';
        
        if (query.trim()) {
          // If there's a query, perform search directly
          this.performSearch(query);
          this.openAdvancedSearchDialog();
        } else {
          // Otherwise open the search dialog
          this.openAdvancedSearchDialog();
        }
      });
    }

    // Connect the global search input for Enter key
    const globalSearchInput = document.getElementById('global-search');
    if (globalSearchInput) {
      globalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = e.target.value.trim();
          if (query) {
            this.performSearch(query);
            this.openAdvancedSearchDialog();
          } else {
            this.openAdvancedSearchDialog();
          }
        }
      });

      // Real-time search as user types
      globalSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length >= this.minQueryLength) {
          clearTimeout(this.searchTimeout);
          this.searchTimeout = setTimeout(() => {
            this.performQuickSearch(query);
          }, 500);
        }
      });
    }

    console.log('🔍 Advanced Search connected to existing UI elements');
  }

  /**
   * Build comprehensive search index
   */
  buildSearchIndex() {
    console.log('🔍 Building search index...');
    this.searchIndex.clear();

    // Index routes
    if (STATE.data && STATE.data.routes) {
      STATE.data.routes.forEach(route => {
        const routeKey = `${route.name}_${route.shift}`;
        const searchData = {
          id: routeKey,
          type: 'route',
          name: route.name,
          shift: route.shift,
          routeType: route.type,
          status: STATE.routeStatus[routeKey] || 'unassigned',
          assignments: STATE.assignments[routeKey] || {},
          notes: STATE.routeNotes[routeKey] || '',
          timestamps: STATE.statusTimestamps[routeKey] || [],
          searchableText: `${route.name} ${route.type} ${route.shift}`,
          category: 'routes'
        };
        
        // Add assignment info to searchable text
        const assignment = STATE.assignments[routeKey];
        if (assignment) {
          if (assignment.driver) searchData.searchableText += ` ${assignment.driver}`;
          if (assignment.escort) searchData.searchableText += ` ${assignment.escort}`;
          if (assignment.asset) searchData.searchableText += ` ${assignment.asset}`;
        }

        // Add notes to searchable text if option enabled
        if (this.searchFilters.options.searchNotes && searchData.notes) {
          searchData.searchableText += ` ${searchData.notes}`;
        }

        this.searchIndex.set(routeKey, searchData);
      });
    }

    // Index field trips
    if (STATE.data && STATE.data.fieldTrips) {
      STATE.data.fieldTrips.forEach(ft => {
        const searchData = {
          id: ft.id,
          type: 'fieldTrip',
          name: ft.destination,
          shift: ft.shift,
          routeType: 'Field Trip',
          driver: ft.driver,
          escort: ft.escort,
          asset: ft.asset,
          trailer: ft.trailer,
          notes: STATE.fieldTripNotes[ft.id] || '',
          searchableText: `${ft.destination} ${ft.shift} field trip`,
          category: 'fieldTrips'
        };

        // Add assignments to searchable text
        if (ft.driver) searchData.searchableText += ` ${ft.driver}`;
        if (ft.escort) searchData.searchableText += ` ${ft.escort}`;
        if (ft.asset) searchData.searchableText += ` ${ft.asset}`;
        if (ft.trailer) searchData.searchableText += ` ${ft.trailer}`;

        if (this.searchFilters.options.searchNotes && searchData.notes) {
          searchData.searchableText += ` ${searchData.notes}`;
        }

        this.searchIndex.set(ft.id, searchData);
      });
    }

    // Index staff
    if (STATE.data && STATE.data.staff) {
      STATE.data.staff.forEach(staff => {
        const isOut = STATE.staffOut.some(s => s.name === staff.name);
        const assignments = this.getStaffAssignments(staff.name);
        
        const searchData = {
          id: staff.name,
          type: 'staff',
          name: staff.name,
          role: staff.role,
          status: isOut ? 'out' : 'available',
          assignments: assignments,
          searchableText: `${staff.name} ${staff.role}`,
          category: 'staff'
        };

        // Add assignment info to searchable text
        if (this.searchFilters.options.searchAssignments && assignments.length > 0) {
          searchData.searchableText += ` ${assignments.join(' ')}`;
        }

        this.searchIndex.set(staff.name, searchData);
      });
    }

    // Index assets
    if (STATE.data && STATE.data.assets) {
      STATE.data.assets.forEach(asset => {
        const status = STATE.assetStatus[asset.name] || 'active';
        const assignments = this.getAssetAssignments(asset.name);
        
        const searchData = {
          id: asset.name,
          type: 'asset',
          name: asset.name,
          assetType: asset.type,
          status: status,
          assignments: assignments,
          searchableText: `${asset.name} ${asset.type}`,
          category: 'assets'
        };

        if (this.searchFilters.options.searchAssignments && assignments.length > 0) {
          searchData.searchableText += ` ${assignments.join(' ')}`;
        }

        this.searchIndex.set(asset.name, searchData);
      });
    }

    console.log(`✅ Search index built with ${this.searchIndex.size} items`);
  }

  /**
   * Get staff assignments
   */
  getStaffAssignments(staffName) {
    const assignments = [];
    
    // Check route assignments
    Object.entries(STATE.assignments).forEach(([routeKey, assignment]) => {
      if (assignment.driver === staffName) assignments.push(`Driver:${routeKey}`);
      if (assignment.escort === staffName) assignments.push(`Escort:${routeKey}`);
    });

    // Check field trip assignments
    if (STATE.data && STATE.data.fieldTrips) {
      STATE.data.fieldTrips.forEach(ft => {
        if (ft.driver === staffName) assignments.push(`Driver:${ft.id}`);
        if (ft.escort === staffName) assignments.push(`Escort:${ft.id}`);
      });
    }

    return assignments;
  }

  /**
   * Get asset assignments
   */
  getAssetAssignments(assetName) {
    const assignments = [];
    
    // Check route assignments
    Object.entries(STATE.assignments).forEach(([routeKey, assignment]) => {
      if (assignment.asset === assetName) assignments.push(routeKey);
    });

    // Check field trip assignments
    if (STATE.data && STATE.data.fieldTrips) {
      STATE.data.fieldTrips.forEach(ft => {
        if (ft.asset === assetName) assignments.push(ft.id);
        if (ft.trailer === assetName) assignments.push(ft.id);
      });
    }

    return assignments;
  }

  /**
   * Perform fuzzy search with scoring
   */
  performFuzzySearch(query, searchableText) {
    if (!this.searchFilters.options.fuzzySearch) {
      // Simple case-sensitive/insensitive search
      const text = this.searchFilters.options.caseSensitive ? searchableText : searchableText.toLowerCase();
      const searchQuery = this.searchFilters.options.caseSensitive ? query : query.toLowerCase();
      
      if (this.searchFilters.options.wholeWords) {
        const regex = new RegExp(`\\b${searchQuery}\\b`, 'g');
        return regex.test(text) ? 1 : 0;
      } else {
        return text.includes(searchQuery) ? 1 : 0;
      }
    }

    // Fuzzy search with Levenshtein distance
    const words = query.toLowerCase().split(/\s+/);
    const textWords = searchableText.toLowerCase().split(/\s+/);
    
    let totalScore = 0;
    let matchedWords = 0;

    words.forEach(queryWord => {
      let bestScore = 0;
      
      textWords.forEach(textWord => {
        const distance = this.levenshteinDistance(queryWord, textWord);
        const maxLength = Math.max(queryWord.length, textWord.length);
        const similarity = 1 - (distance / maxLength);
        
        // Boost exact matches and prefix matches
        if (textWord === queryWord) {
          bestScore = Math.max(bestScore, 1.0);
        } else if (textWord.startsWith(queryWord)) {
          bestScore = Math.max(bestScore, 0.9);
        } else if (similarity > 0.7) {
          bestScore = Math.max(bestScore, similarity);
        }
      });

      if (bestScore > 0.7) {
        totalScore += bestScore;
        matchedWords++;
      }
    });

    // Return normalized score
    return matchedWords > 0 ? totalScore / words.length : 0;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Perform advanced search with filters
   */
  performSearch(query, customFilters = null) {
    const startTime = performance.now();
    
    if (!query || query.length < this.minQueryLength) {
      this.clearSearchResults();
      return [];
    }

    // Record analytics
    this.recordSearchAnalytics(query);

    const filters = customFilters || this.searchFilters;
    const results = [];

    // Search through index
    this.searchIndex.forEach((item, key) => {
      let score = 0;
      
      // Apply category filter
      if (filters.routes && item.category !== 'routes' && item.category !== 'fieldTrips') return;
      if (filters.staff && item.category !== 'staff') return;
      if (filters.assets && item.category !== 'assets') return;

      // Apply status filters
      if (filters.status && filters.status !== 'all' && item.status !== filters.status) return;

      // Apply time range filters
      if (filters.timeRange && filters.timeRange.from && item.timestamps) {
        const hasRecentActivity = this.checkTimeRangeFilter(item.timestamps, filters.timeRange);
        if (!hasRecentActivity) return;
      }

      // Perform search on searchable text
      score = this.performFuzzySearch(query, item.searchableText);
      
      if (score > 0) {
        results.push({
          ...item,
          score: score,
          highlights: this.generateHighlights(query, item)
        });
      }
    });

    // Sort by score (descending) and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, this.maxResults);

    // Record search time
    const searchTime = performance.now() - startTime;
    this.searchAnalytics.searchTimes.push(searchTime);
    this.searchAnalytics.resultCounts.push(limitedResults.length);

    this.currentResults = limitedResults;
    this.displaySearchResults(limitedResults, query);

    console.log(`🔍 Search completed: "${query}" - ${limitedResults.length} results in ${searchTime.toFixed(2)}ms`);
    
    return limitedResults;
  }

  /**
   * Perform quick search without opening full dialog
   */
  performQuickSearch(query) {
    const results = this.performSearch(query);
    
    // Show results in a quick preview or highlight matches in the main view
    if (results.length > 0) {
      this.highlightSearchMatches(results);
    } else {
      this.clearSearchHighlights();
    }
    
    return results;
  }

  /**
   * Check if item matches time range filter
   */
  checkTimeRangeFilter(timestamps, timeRange) {
    if (!timestamps || timestamps.length === 0) return false;
    
    const fromDate = timeRange.from ? new Date(timeRange.from) : null;
    const toDate = timeRange.to ? new Date(timeRange.to) : null;
    
    return timestamps.some(ts => {
      const tsDate = new Date(ts.timestamp);
      
      if (fromDate && tsDate < fromDate) return false;
      if (toDate && tsDate > toDate) return false;
      
      return true;
    });
  }

  /**
   * Generate highlights for search results
   */
  generateHighlights(query, item) {
    const highlights = {};
    const queryWords = query.toLowerCase().split(/\s+/);
    
    // Highlight in name
    highlights.name = this.highlightText(item.name, queryWords);
    
    // Highlight in searchable text
    highlights.description = this.highlightText(item.searchableText, queryWords);
    
    return highlights;
  }

  /**
   * Highlight matching text
   */
  highlightText(text, queryWords) {
    let highlightedText = text;
    
    queryWords.forEach(word => {
      if (word.length < 2) return;
      
      const regex = new RegExp(`(${word})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="search-highlight">$1</mark>');
    });
    
    return highlightedText;
  }

  /**
   * Record search analytics
   */
  recordSearchAnalytics(query) {
    this.searchAnalytics.totalSearches++;
    
    // Track top queries
    const normalizedQuery = query.toLowerCase().trim();
    const currentCount = this.searchAnalytics.topQueries.get(normalizedQuery) || 0;
    this.searchAnalytics.topQueries.set(normalizedQuery, currentCount + 1);
    
    // Add to history
    this.addToHistory(query);
    
    this.saveSearchData();
  }

  /**
   * Save a search for later use
   */
  saveSearch(name, query, filters) {
    const savedSearch = {
      id: `search_${Date.now()}`,
      name: name,
      query: query,
      filters: { ...filters },
      created: new Date().toISOString(),
      useCount: 0
    };
    
    this.savedSearches.unshift(savedSearch);
    this.saveSearchData();
    
    eventBus.emit('search:saved', { search: savedSearch });
    uiSystem.showNotification(`Search "${name}" saved`, 'success');
    
    console.log('🔍 Search saved:', name);
  }

  /**
   * Load a saved search
   */
  loadSavedSearch(searchId) {
    const savedSearch = this.savedSearches.find(s => s.id === searchId);
    if (!savedSearch) return;
    
    savedSearch.useCount++;
    this.saveSearchData();
    
    // Apply the saved search
    this.searchFilters = { ...savedSearch.filters };
    this.performSearch(savedSearch.query, savedSearch.filters);
    
    eventBus.emit('search:loaded', { search: savedSearch });
    console.log('🔍 Loaded saved search:', savedSearch.name);
  }

  /**
   * Delete a saved search
   */
  deleteSavedSearch(searchId) {
    const index = this.savedSearches.findIndex(s => s.id === searchId);
    if (index !== -1) {
      const deleted = this.savedSearches.splice(index, 1)[0];
      this.saveSearchData();
      
      eventBus.emit('search:deleted', { search: deleted });
      uiSystem.showNotification(`Search "${deleted.name}" deleted`, 'info');
      
      console.log('🔍 Deleted saved search:', deleted.name);
    }
  }

  /**
   * Display search results in the UI
   */
  displaySearchResults(results, query) {
    if (!this.searchResults) return;
    
    this.searchResults.innerHTML = '';
    
    if (results.length === 0) {
      this.searchResults.innerHTML = `
        <div class="search-no-results">
          <div class="no-results-icon">🔍</div>
          <div class="no-results-text">No results found for "${query}"</div>
          <div class="no-results-suggestions">
            <p>Try:</p>
            <ul>
              <li>Using different keywords</li>
              <li>Checking spelling</li>
              <li>Using fewer or broader terms</li>
              <li>Enabling fuzzy search</li>
            </ul>
          </div>
        </div>
      `;
      return;
    }

    // Group results by category
    const groupedResults = this.groupResultsByCategory(results);
    
    Object.entries(groupedResults).forEach(([category, categoryResults]) => {
      const categorySection = document.createElement('div');
      categorySection.className = 'search-results-category';
      
      categorySection.innerHTML = `
        <div class="search-category-header">
          <h4>${this.getCategoryLabel(category)} (${categoryResults.length})</h4>
        </div>
        <div class="search-category-results">
          ${categoryResults.map(result => this.renderSearchResult(result)).join('')}
        </div>
      `;
      
      this.searchResults.appendChild(categorySection);
    });

    // Add result count
    const resultCount = document.createElement('div');
    resultCount.className = 'search-result-count';
    resultCount.innerHTML = `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`;
    this.searchResults.insertBefore(resultCount, this.searchResults.firstChild);
  }

  /**
   * Group search results by category
   */
  groupResultsByCategory(results) {
    const grouped = {};
    
    results.forEach(result => {
      if (!grouped[result.category]) {
        grouped[result.category] = [];
      }
      grouped[result.category].push(result);
    });
    
    return grouped;
  }

  /**
   * Get display label for category
   */
  getCategoryLabel(category) {
    const labels = {
      routes: 'Routes',
      fieldTrips: 'Field Trips',
      staff: 'Staff',
      assets: 'Assets'
    };
    return labels[category] || category;
  }

  /**
   * Render individual search result
   */
  renderSearchResult(result) {
    const statusClass = this.getStatusClass(result.status);
    const typeIcon = this.getTypeIcon(result.type);
    
    return `
      <div class="search-result-item" data-type="${result.type}" data-id="${result.id}">
        <div class="search-result-icon">${typeIcon}</div>
        <div class="search-result-content">
          <div class="search-result-name">${result.highlights.name || result.name}</div>
          <div class="search-result-meta">
            <span class="search-result-type">${result.type}</span>
            <span class="search-result-status ${statusClass}">${result.status}</span>
            ${result.score ? `<span class="search-result-score">Score: ${(result.score * 100).toFixed(0)}%</span>` : ''}
          </div>
          ${result.highlights.description ? `
            <div class="search-result-description">${result.highlights.description}</div>
          ` : ''}
        </div>
        <div class="search-result-actions">
          <button class="btn btn-sm btn-primary" onclick="advancedSearchSystem.focusResult('${result.id}', '${result.type}')">
            View
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get status CSS class
   */
  getStatusClass(status) {
    const classes = {
      available: 'status-available',
      assigned: 'status-assigned',
      out: 'status-out',
      down: 'status-down',
      active: 'status-active',
      unassigned: 'status-unassigned'
    };
    return classes[status] || 'status-default';
  }

  /**
   * Get type icon
   */
  getTypeIcon(type) {
    const icons = {
      route: '🛣️',
      fieldTrip: '🚌',
      staff: '👤',
      asset: '🚛'
    };
    return icons[type] || '📋';
  }

  /**
   * Focus on a search result item
   */
  focusResult(id, type) {
    // Close search overlay
    this.closeSearchOverlay();
    
    // Emit event to focus the item
    eventBus.emit('search:focusResult', { id, type });
    
    // Scroll to and highlight the item
    const element = document.querySelector(`[data-${type}-id="${id}"], [data-route-key="${id}"], [data-staff-name="${id}"], [data-asset-name="${id}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('search-focused');
      
      setTimeout(() => {
        element.classList.remove('search-focused');
      }, 3000);
    }
    
    console.log(`🔍 Focused result: ${type} ${id}`);
  }

  /**
   * Open advanced search dialog
   */
  openAdvancedSearchDialog(advanced = false) {
    const modal = uiSystem.createModal('advanced-search-modal', 'Advanced Search', this.createAdvancedSearchContent(advanced));
    uiSystem.openModal(modal.id);
    
    this.setupAdvancedSearchHandlers();
    
    // Focus search input
    setTimeout(() => {
      const searchInput = document.getElementById('advanced-search-input');
      if (searchInput) searchInput.focus();
    }, 100);
  }

  /**
   * Create advanced search dialog content
   */
  createAdvancedSearchContent(showAdvanced = false) {
    return `
      <div class="advanced-search-container">
        <div class="search-tabs">
          <button class="tab-btn ${!showAdvanced ? 'active' : ''}" data-tab="basic">Basic Search</button>
          <button class="tab-btn ${showAdvanced ? 'active' : ''}" data-tab="advanced">Advanced</button>
          <button class="tab-btn" data-tab="saved">Saved Searches</button>
          <button class="tab-btn" data-tab="analytics">Analytics</button>
        </div>

        <div class="tab-content ${!showAdvanced ? '' : 'hidden'}" id="basic-tab">
          <div class="search-input-section">
            <input type="text" id="advanced-search-input" placeholder="Search routes, staff, assets..." class="search-input-large">
            <button id="perform-search-btn" class="btn btn-primary">Search</button>
          </div>

          <div class="quick-filters">
            <button class="filter-btn" data-filter="routes">Routes</button>
            <button class="filter-btn" data-filter="staff">Staff</button>
            <button class="filter-btn" data-filter="assets">Assets</button>
            <button class="filter-btn" data-filter="assigned">Assigned</button>
            <button class="filter-btn" data-filter="unassigned">Unassigned</button>
          </div>

          <div class="search-results-container">
            <div id="search-results-display"></div>
          </div>
        </div>

        <div class="tab-content ${showAdvanced ? '' : 'hidden'}" id="advanced-tab">
          ${this.createAdvancedFiltersContent()}
        </div>

        <div class="tab-content hidden" id="saved-tab">
          ${this.createSavedSearchesContent()}
        </div>

        <div class="tab-content hidden" id="analytics-tab">
          ${this.createAnalyticsContent()}
        </div>
      </div>
    `;
  }

  /**
   * Create advanced filters content
   */
  createAdvancedFiltersContent() {
    return `
      <div class="advanced-filters">
        <div class="filter-section">
          <h4>Search Options</h4>
          <label class="checkbox-label">
            <input type="checkbox" id="fuzzy-search" ${this.searchFilters.options.fuzzySearch ? 'checked' : ''}>
            Enable fuzzy search (matches similar terms)
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="case-sensitive" ${this.searchFilters.options.caseSensitive ? 'checked' : ''}>
            Case sensitive search
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="whole-words" ${this.searchFilters.options.wholeWords ? 'checked' : ''}>
            Match whole words only
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="search-notes" ${this.searchFilters.options.searchNotes ? 'checked' : ''}>
            Include notes in search
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="search-assignments" ${this.searchFilters.options.searchAssignments ? 'checked' : ''}>
            Include assignments in search
          </label>
        </div>

        <div class="filter-section">
          <h4>Time Range</h4>
          <div class="time-range-inputs">
            <label>From: <input type="datetime-local" id="time-from" value="${this.searchFilters.timeRange.from}"></label>
            <label>To: <input type="datetime-local" id="time-to" value="${this.searchFilters.timeRange.to}"></label>
          </div>
        </div>

        <div class="filter-section">
          <h4>Quick Queries</h4>
          <div class="quick-query-buttons">
            <button class="btn btn-sm btn-secondary" onclick="advancedSearchSystem.setQuickQuery('unassigned routes')">Unassigned Routes</button>
            <button class="btn btn-sm btn-secondary" onclick="advancedSearchSystem.setQuickQuery('staff out')">Staff Out</button>
            <button class="btn btn-sm btn-secondary" onclick="advancedSearchSystem.setQuickQuery('assets down')">Assets Down</button>
            <button class="btn btn-sm btn-secondary" onclick="advancedSearchSystem.setQuickQuery('field trips')">Field Trips</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create saved searches content
   */
  createSavedSearchesContent() {
    const savedSearchesHtml = this.savedSearches.map(search => `
      <div class="saved-search-item">
        <div class="saved-search-info">
          <div class="saved-search-name">${search.name}</div>
          <div class="saved-search-query">"${search.query}"</div>
          <div class="saved-search-meta">
            Created: ${new Date(search.created).toLocaleDateString()} | Used: ${search.useCount} times
          </div>
        </div>
        <div class="saved-search-actions">
          <button class="btn btn-sm btn-primary" onclick="advancedSearchSystem.loadSavedSearch('${search.id}')">Load</button>
          <button class="btn btn-sm btn-danger" onclick="advancedSearchSystem.deleteSavedSearch('${search.id}')">Delete</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="saved-searches">
        <div class="save-current-search">
          <input type="text" id="save-search-name" placeholder="Enter name for current search">
          <button class="btn btn-primary" onclick="advancedSearchSystem.saveCurrentSearch()">Save Current Search</button>
        </div>
        
        <div class="saved-searches-list">
          ${savedSearchesHtml || '<div class="no-saved-searches">No saved searches yet</div>'}
        </div>
      </div>
    `;
  }

  /**
   * Create analytics content
   */
  createAnalyticsContent() {
    const topQueries = Array.from(this.searchAnalytics.topQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const avgSearchTime = this.searchAnalytics.searchTimes.length > 0
      ? (this.searchAnalytics.searchTimes.reduce((a, b) => a + b, 0) / this.searchAnalytics.searchTimes.length).toFixed(2)
      : 0;

    const avgResultCount = this.searchAnalytics.resultCounts.length > 0
      ? (this.searchAnalytics.resultCounts.reduce((a, b) => a + b, 0) / this.searchAnalytics.resultCounts.length).toFixed(1)
      : 0;

    return `
      <div class="search-analytics">
        <div class="analytics-stats">
          <div class="stat-item">
            <div class="stat-value">${this.searchAnalytics.totalSearches}</div>
            <div class="stat-label">Total Searches</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${avgSearchTime}ms</div>
            <div class="stat-label">Avg Search Time</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${avgResultCount}</div>
            <div class="stat-label">Avg Results</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${this.searchHistory.length}</div>
            <div class="stat-label">Search History</div>
          </div>
        </div>

        <div class="top-queries">
          <h4>Top Queries</h4>
          <div class="top-queries-list">
            ${topQueries.map(([query, count]) => `
              <div class="top-query-item">
                <span class="query-text">"${query}"</span>
                <span class="query-count">${count} times</span>
              </div>
            `).join('') || '<div class="no-data">No search data yet</div>'}
          </div>
        </div>

        <div class="search-history">
          <h4>Recent Searches</h4>
          <div class="search-history-list">
            ${this.searchHistory.slice(0, 20).map(query => `
              <div class="history-item">
                <span class="history-query">"${query}"</span>
                <button class="btn btn-sm btn-secondary" onclick="advancedSearchSystem.setQuickQuery('${query}')">Search Again</button>
              </div>
            `).join('') || '<div class="no-data">No search history yet</div>'}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup advanced search dialog handlers
   */
  setupAdvancedSearchHandlers() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.showSearchTab(tabName);
      });
    });

    // Search input and button
    const searchInput = document.getElementById('advanced-search-input');
    const searchBtn = document.getElementById('perform-search-btn');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.performSearch(e.target.value);
        }, 300);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.performSearch(e.target.value);
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (searchInput) {
          this.performSearch(searchInput.value);
        }
      });
    }

    // Quick filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.applyQuickFilter(e.target.dataset.filter);
      });
    });

    // Advanced filter options
    const filterInputs = ['fuzzy-search', 'case-sensitive', 'whole-words', 'search-notes', 'search-assignments'];
    filterInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', (e) => {
          this.updateSearchOptions(id.replace(/-/g, ''), e.target.checked);
        });
      }
    });

    // Time range inputs
    const timeFromInput = document.getElementById('time-from');
    const timeToInput = document.getElementById('time-to');
    
    if (timeFromInput) {
      timeFromInput.addEventListener('change', (e) => {
        this.searchFilters.timeRange.from = e.target.value;
      });
    }

    if (timeToInput) {
      timeToInput.addEventListener('change', (e) => {
        this.searchFilters.timeRange.to = e.target.value;
      });
    }

    // Setup results display
    this.searchResults = document.getElementById('search-results-display');
  }

  /**
   * Show specific search tab
   */
  showSearchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
    });
  }

  /**
   * Apply quick filter
   */
  applyQuickFilter(filter) {
    // Clear other filters first
    this.searchFilters.routes = '';
    this.searchFilters.staff = '';
    this.searchFilters.assets = '';
    this.searchFilters.status = 'all';

    // Apply selected filter
    switch (filter) {
      case 'routes':
        this.searchFilters.routes = true;
        break;
      case 'staff':
        this.searchFilters.staff = true;
        break;
      case 'assets':
        this.searchFilters.assets = true;
        break;
      case 'assigned':
        this.searchFilters.status = 'assigned';
        break;
      case 'unassigned':
        this.searchFilters.status = 'unassigned';
        break;
    }

    // Re-run current search with new filters
    const searchInput = document.getElementById('advanced-search-input');
    if (searchInput && searchInput.value) {
      this.performSearch(searchInput.value);
    }
  }

  /**
   * Update search options
   */
  updateSearchOptions(option, value) {
    switch (option) {
      case 'fuzzysearch':
        this.searchFilters.options.fuzzySearch = value;
        break;
      case 'casesensitive':
        this.searchFilters.options.caseSensitive = value;
        break;
      case 'wholewords':
        this.searchFilters.options.wholeWords = value;
        break;
      case 'searchnotes':
        this.searchFilters.options.searchNotes = value;
        break;
      case 'searchassignments':
        this.searchFilters.options.searchAssignments = value;
        break;
    }

    this.saveSearchData();

    // Re-run current search with new options
    const searchInput = document.getElementById('advanced-search-input');
    if (searchInput && searchInput.value) {
      this.performSearch(searchInput.value);
    }
  }

  /**
   * Set quick query
   */
  setQuickQuery(query) {
    const searchInput = document.getElementById('advanced-search-input');
    if (searchInput) {
      searchInput.value = query;
      this.performSearch(query);
    }
  }

  /**
   * Save current search
   */
  saveCurrentSearch() {
    const nameInput = document.getElementById('save-search-name');
    const searchInput = document.getElementById('advanced-search-input');
    
    if (!nameInput || !searchInput) return;
    
    const name = nameInput.value.trim();
    const query = searchInput.value.trim();
    
    if (!name || !query) {
      uiSystem.showNotification('Please enter both name and search query', 'warning');
      return;
    }

    this.saveSearch(name, query, this.searchFilters);
    nameInput.value = '';
  }

  /**
   * Add to search history
   */
  addToHistory(query) {
    // Remove if already exists
    const index = this.searchHistory.indexOf(query);
    if (index > -1) {
      this.searchHistory.splice(index, 1);
    }

    // Add to beginning
    this.searchHistory.unshift(query);

    // Limit history size
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(0, 50);
    }
  }

  /**
   * Clear search results
   */
  clearSearchResults() {
    this.currentResults = [];
    if (this.searchResults) {
      this.searchResults.innerHTML = '';
    }
  }

  /**
   * Close search overlay
   */
  closeSearchOverlay() {
    uiSystem.closeCurrentModal();
  }

  /**
   * Check if search is open
   */
  isSearchOpen() {
    return uiSystem.isModalOpen() && document.getElementById('advanced-search-modal');
  }

  /**
   * Rebuild search index
   */
  rebuildSearchIndex() {
    console.log('🔍 Rebuilding search index...');
    this.buildSearchIndex();
  }

  /**
   * Get search analytics
   */
  getAnalytics() {
    return {
      ...this.searchAnalytics,
      indexSize: this.searchIndex.size,
      historySize: this.searchHistory.length,
      savedSearchCount: this.savedSearches.length
    };
  }

  /**
   * Highlight search matches in the main view
   */
  highlightSearchMatches(results) {
    // Clear existing highlights
    this.clearSearchHighlights();
    
    // Highlight matching elements in the main dashboard
    results.forEach(result => {
      const elements = this.findElementsInMainView(result);
      elements.forEach(element => {
        element.classList.add('search-match-highlight');
      });
    });
    
    // Add a search indicator to show how many matches
    this.showSearchIndicator(results.length);
  }

  /**
   * Clear search highlights from main view
   */
  clearSearchHighlights() {
    document.querySelectorAll('.search-match-highlight').forEach(element => {
      element.classList.remove('search-match-highlight');
    });
    
    this.hideSearchIndicator();
  }

  /**
   * Find elements in main view that correspond to search result
   */
  findElementsInMainView(result) {
    const elements = [];
    
    // Find elements based on result type and ID
    switch (result.type) {
      case 'route':
      case 'fieldTrip':
        // Look for route cards
        const routeElements = document.querySelectorAll(`[data-route-key="${result.id}"], [data-field-trip-id="${result.id}"]`);
        elements.push(...routeElements);
        break;
        
      case 'staff':
        // Look for staff elements
        const staffElements = document.querySelectorAll(`[data-staff-name="${result.id}"]`);
        elements.push(...staffElements);
        break;
        
      case 'asset':
        // Look for asset elements
        const assetElements = document.querySelectorAll(`[data-asset-name="${result.id}"]`);
        elements.push(...assetElements);
        break;
    }
    
    return elements;
  }

  /**
   * Show search indicator with match count
   */
  showSearchIndicator(count) {
    // Remove existing indicator
    this.hideSearchIndicator();
    
    const indicator = document.createElement('div');
    indicator.id = 'search-indicator';
    indicator.className = 'fixed top-20 right-4 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg z-50 text-sm font-medium';
    indicator.innerHTML = `🔍 ${count} match${count !== 1 ? 'es' : ''} found`;
    
    document.body.appendChild(indicator);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hideSearchIndicator();
    }, 3000);
  }

  /**
   * Hide search indicator
   */
  hideSearchIndicator() {
    const indicator = document.getElementById('search-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
}

// Create and export singleton instance
const advancedSearchSystem = new AdvancedSearchSystem();

// Make functions globally accessible for inline event handlers
window.advancedSearchSystem = advancedSearchSystem;
window.openQuickSearchDialog = () => advancedSearchSystem.openAdvancedSearchDialog();
window.openAdvancedSearchDialog = (advanced) => advancedSearchSystem.openAdvancedSearchDialog(advanced);

export { advancedSearchSystem };