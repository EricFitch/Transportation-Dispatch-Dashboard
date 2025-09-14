/**
 * Field Trips Management Module
 * Handles field trip requests, scheduling, and approvals
 */

import { eventBus } from '../core/utils.js';
import { STATE, getState, setState } from '../core/state.js';
import { formatDate, generateId } from '../core/utils.js';

export class FieldTripsManager {
    constructor() {
        this.eventBus = eventBus;
        this.fieldTrips = [];
        this.init();
    }

    init() {
        this.loadFieldTrips();
        this.setupEventListeners();
        console.log('✅ Field Trips Manager initialized');
    }

    setupEventListeners() {
        this.eventBus.on('fieldTrip:create', (tripData) => this.createFieldTrip(tripData));
        this.eventBus.on('fieldTrip:update', (tripId, updates) => this.updateFieldTrip(tripId, updates));
        this.eventBus.on('fieldTrip:delete', (tripId) => this.deleteFieldTrip(tripId));
        this.eventBus.on('fieldTrip:approve', (tripId) => this.approveFieldTrip(tripId));
        this.eventBus.on('fieldTrip:schedule', (tripId, schedule) => this.scheduleFieldTrip(tripId, schedule));
    }

    loadFieldTrips() {
        try {
            const stored = getState('fieldTrips');
            this.fieldTrips = stored || [];
        } catch (error) {
            console.warn('Failed to load field trips:', error);
            this.fieldTrips = [];
        }
    }

    createFieldTrip(tripData) {
        const fieldTrip = {
            id: generateId(),
            title: tripData.title || '',
            description: tripData.description || '',
            requestedBy: tripData.requestedBy || '',
            destination: tripData.destination || '',
            date: tripData.date || '',
            time: tripData.time || '',
            passengerCount: tripData.passengerCount || 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...tripData
        };

        this.fieldTrips.push(fieldTrip);
        this.saveFieldTrips();
        this.eventBus.emit('fieldTrip:created', fieldTrip);
        return fieldTrip;
    }

    updateFieldTrip(tripId, updates) {
        const index = this.fieldTrips.findIndex(trip => trip.id === tripId);
        if (index === -1) return null;

        this.fieldTrips[index] = {
            ...this.fieldTrips[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.saveFieldTrips();
        this.eventBus.emit('fieldTrip:updated', this.fieldTrips[index]);
        return this.fieldTrips[index];
    }

    deleteFieldTrip(tripId) {
        const index = this.fieldTrips.findIndex(trip => trip.id === tripId);
        if (index === -1) return false;

        const deleted = this.fieldTrips.splice(index, 1)[0];
        this.saveFieldTrips();
        this.eventBus.emit('fieldTrip:deleted', deleted);
        return true;
    }

    approveFieldTrip(tripId) {
        return this.updateFieldTrip(tripId, { 
            status: 'approved',
            approvedAt: new Date().toISOString()
        });
    }

    scheduleFieldTrip(tripId, schedule) {
        return this.updateFieldTrip(tripId, {
            status: 'scheduled',
            scheduledAt: new Date().toISOString(),
            assignedVehicle: schedule.vehicle,
            assignedDriver: schedule.driver,
            ...schedule
        });
    }

    getFieldTrip(tripId) {
        return this.fieldTrips.find(trip => trip.id === tripId);
    }

    getAllFieldTrips() {
        return [...this.fieldTrips];
    }

    getFieldTripsByStatus(status) {
        return this.fieldTrips.filter(trip => trip.status === status);
    }

    getPendingFieldTrips() {
        return this.getFieldTripsByStatus('pending');
    }

    getApprovedFieldTrips() {
        return this.getFieldTripsByStatus('approved');
    }

    getScheduledFieldTrips() {
        return this.getFieldTripsByStatus('scheduled');
    }

    saveFieldTrips() {
        setState('fieldTrips', this.fieldTrips);
    }

    // Export functionality
    exportToCSV() {
        const headers = ['ID', 'Title', 'Description', 'Requested By', 'Destination', 'Date', 'Time', 'Passengers', 'Status', 'Created At'];
        const rows = this.fieldTrips.map(trip => [
            trip.id,
            trip.title,
            trip.description,
            trip.requestedBy,
            trip.destination,
            trip.date,
            trip.time,
            trip.passengerCount,
            trip.status,
            formatDate(trip.createdAt)
        ]);

        return [headers, ...rows];
    }
}

// Create and export singleton instance
export const fieldTripsManager = new FieldTripsManager();
export default fieldTripsManager;
