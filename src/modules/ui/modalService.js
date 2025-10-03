/**
 * ModalService - Centralized modal management utility
 * 
 * Handles opening, closing, backdrop clicks, and ESC key handling for all modals.
 * Eliminates ~80 lines of duplicate modal management code across the application.
 * 
 * Usage:
 *   ModalService.open('my-modal-id');
 *   ModalService.close('my-modal-id');
 *   ModalService.setupCloseButton('close-btn-id', 'modal-id');
 * 
 * Features:
 *   - Automatic ESC key handling
 *   - Backdrop click detection
 *   - Multiple modal support
 *   - Callback support for open/close events
 */

import { Logger } from '../core/logger.js';
import { ErrorHandler } from '../core/errorHandler.js';

export class ModalService {
  /**
   * Track which modals are currently open
   */
  static openModals = new Set();
  
  /**
   * ESC key listener (shared across all modals)
   */
  static escKeyListener = null;
  
  /**
   * Open a modal by ID
   * @param {string} modalId - The ID of the modal element
   * @param {Function} onOpen - Optional callback after modal opens
   */
  static open(modalId, onOpen = null) {
    try {
      const modal = document.getElementById(modalId);
      
      if (!modal) {
        Logger.warn(`Modal not found: ${modalId}`);
        return false;
      }
      
      // Remove hidden class to show modal
      modal.classList.remove('hidden');
      
      // Track open modal
      this.openModals.add(modalId);
      
      // Setup ESC key handler if not already setup
      this.setupEscKeyHandler();
      
      // Setup backdrop click handler for this modal
      this.setupBackdropHandler(modalId);
      
      Logger.debug(`Modal opened: ${modalId}`);
      
      // Execute callback if provided
      if (onOpen && typeof onOpen === 'function') {
        onOpen(modal);
      }
      
      return true;
    } catch (err) {
      ErrorHandler.handle(err, {
        context: `ModalService.open(${modalId})`,
        userMessage: 'Failed to open modal',
        showUser: false
      });
      return false;
    }
  }
  
  /**
   * Close a modal by ID
   * @param {string} modalId - The ID of the modal element
   * @param {Function} onClose - Optional callback after modal closes
   */
  static close(modalId, onClose = null) {
    try {
      const modal = document.getElementById(modalId);
      
      if (!modal) {
        Logger.warn(`Modal not found: ${modalId}`);
        return false;
      }
      
      // Add hidden class to hide modal
      modal.classList.add('hidden');
      
      // Remove from open modals tracker
      this.openModals.delete(modalId);
      
      // If no modals are open, remove ESC key handler
      if (this.openModals.size === 0) {
        this.removeEscKeyHandler();
      }
      
      Logger.debug(`Modal closed: ${modalId}`);
      
      // Execute callback if provided
      if (onClose && typeof onClose === 'function') {
        onClose(modal);
      }
      
      return true;
    } catch (err) {
      ErrorHandler.handle(err, {
        context: `ModalService.close(${modalId})`,
        userMessage: 'Failed to close modal',
        showUser: false
      });
      return false;
    }
  }
  
  /**
   * Setup ESC key handler to close the topmost modal
   */
  static setupEscKeyHandler() {
    // Only setup once
    if (this.escKeyListener) return;
    
    this.escKeyListener = (e) => {
      if (e.key === 'Escape' && this.openModals.size > 0) {
        // Close the most recently opened modal
        const lastModal = Array.from(this.openModals).pop();
        this.close(lastModal);
        Logger.debug(`ESC key pressed - closing modal: ${lastModal}`);
      }
    };
    
    document.addEventListener('keydown', this.escKeyListener);
    Logger.debug('ESC key handler setup for modals');
  }
  
  /**
   * Remove ESC key handler
   */
  static removeEscKeyHandler() {
    if (this.escKeyListener) {
      document.removeEventListener('keydown', this.escKeyListener);
      this.escKeyListener = null;
      Logger.debug('ESC key handler removed');
    }
  }
  
  /**
   * Setup backdrop click handler for a modal
   * Closes modal when clicking outside the modal content
   * @param {string} modalId - The ID of the modal element
   */
  static setupBackdropHandler(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Remove existing handler if present
    modal.removeEventListener('click', this._backdropClickHandler);
    
    // Add new handler
    modal.addEventListener('click', (e) => {
      // Check if click was directly on the modal backdrop (not on modal content)
      if (e.target === modal) {
        this.close(modalId);
        Logger.debug(`Backdrop clicked - closing modal: ${modalId}`);
      }
    });
  }
  
  /**
   * Setup a close button for a modal
   * @param {string} buttonId - The ID of the close button
   * @param {string} modalId - The ID of the modal to close
   */
  static setupCloseButton(buttonId, modalId) {
    try {
      const button = document.getElementById(buttonId);
      
      if (!button) {
        Logger.warn(`Close button not found: ${buttonId}`);
        return false;
      }
      
      // Remove existing listeners to prevent duplicates
      const closeHandler = () => this.close(modalId);
      button.removeEventListener('click', closeHandler);
      button.addEventListener('click', closeHandler);
      
      Logger.debug(`Close button setup: ${buttonId} -> ${modalId}`);
      return true;
    } catch (err) {
      ErrorHandler.handle(err, {
        context: `ModalService.setupCloseButton(${buttonId}, ${modalId})`,
        userMessage: 'Failed to setup close button',
        showUser: false
      });
      return false;
    }
  }
  
  /**
   * Check if a modal is currently open
   * @param {string} modalId - The ID of the modal element
   * @returns {boolean} True if modal is open
   */
  static isOpen(modalId) {
    return this.openModals.has(modalId);
  }
  
  /**
   * Close all open modals
   */
  static closeAll() {
    const modals = Array.from(this.openModals);
    modals.forEach(modalId => this.close(modalId));
    Logger.debug('All modals closed');
  }
  
  /**
   * Get count of currently open modals
   * @returns {number} Number of open modals
   */
  static getOpenCount() {
    return this.openModals.size;
  }
}

// Make globally accessible for debugging
if (typeof window !== 'undefined') {
  window.ModalService = ModalService;
  Logger.debug('ModalService available globally as window.ModalService');
}
