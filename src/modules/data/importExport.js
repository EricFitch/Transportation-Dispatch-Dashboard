/**
 * Data Import/Export Module
 * Handles CSV import/export, data validation, and template generation
 */

import { eventBus } from '../core/utils.js';
import { STATE, getState, setState } from '../core/state.js';
import { formatDate, generateId } from '../core/utils.js';

export class ImportExportManager {
    constructor() {
        this.eventBus = eventBus;
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('✅ Import/Export Manager initialized');
    }

    setupEventListeners() {
        this.eventBus.on('data:import', (data, type) => this.importData(data, type));
        this.eventBus.on('data:export', (type, format) => this.exportData(type, format));
        this.eventBus.on('template:generate', (type) => this.generateTemplate(type));
        this.eventBus.on('data:validate', (data, schema) => this.validateData(data, schema));
    }

    // CSV Import functionality
    async importCSV(file, type = 'routes') {
        try {
            const text = await this.readFileAsText(file);
            const data = this.parseCSV(text);
            
            if (data.length === 0) {
                throw new Error('No data found in CSV file');
            }

            const validatedData = this.validateImportData(data, type);
            await this.processImportData(validatedData, type);
            
            this.eventBus.emit('data:imported', { type, count: validatedData.length });
            return { success: true, imported: validatedData.length };
        } catch (error) {
            console.error('CSV import failed:', error);
            this.eventBus.emit('data:import-error', error);
            throw error;
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }

        return data;
    }

    validateImportData(data, type) {
        const schemas = this.getValidationSchemas();
        const schema = schemas[type];
        
        if (!schema) {
            throw new Error(`No validation schema found for type: ${type}`);
        }

        return data.map((row, index) => {
            const validated = this.validateRow(row, schema, index + 2); // +2 for header and 0-indexing
            return {
                ...validated,
                id: generateId(),
                importedAt: new Date().toISOString()
            };
        });
    }

    validateRow(row, schema, lineNumber) {
        const validated = {};
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = row[field];
            
            if (rules.required && (!value || value.trim() === '')) {
                errors.push(`Line ${lineNumber}: ${field} is required`);
                continue;
            }

            if (value) {
                if (rules.type === 'number') {
                    const num = parseFloat(value);
                    if (isNaN(num)) {
                        errors.push(`Line ${lineNumber}: ${field} must be a number`);
                    } else {
                        validated[field] = num;
                    }
                } else if (rules.type === 'date') {
                    const date = new Date(value);
                    if (isNaN(date.getTime())) {
                        errors.push(`Line ${lineNumber}: ${field} must be a valid date`);
                    } else {
                        validated[field] = date.toISOString();
                    }
                } else {
                    validated[field] = value.trim();
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        return validated;
    }

    getValidationSchemas() {
        return {
            routes: {
                'Route Name': { required: true, type: 'string' },
                'Driver': { required: false, type: 'string' },
                'Vehicle': { required: false, type: 'string' },
                'Start Time': { required: false, type: 'string' },
                'Status': { required: false, type: 'string' }
            },
            staff: {
                'Name': { required: true, type: 'string' },
                'Role': { required: true, type: 'string' },
                'Phone': { required: false, type: 'string' },
                'Email': { required: false, type: 'string' },
                'Status': { required: false, type: 'string' }
            },
            vehicles: {
                'Vehicle ID': { required: true, type: 'string' },
                'Type': { required: true, type: 'string' },
                'Capacity': { required: false, type: 'number' },
                'Status': { required: false, type: 'string' }
            }
        };
    }

    async processImportData(data, type) {
        const stateKey = this.getStateKey(type);
        const existing = getState(stateKey) || [];
        
        // Merge with existing data
        const merged = [...existing, ...data];
        setState(stateKey, merged);
        
        this.eventBus.emit(`${type}:imported`, data);
    }

    getStateKey(type) {
        const mapping = {
            routes: 'routes',
            staff: 'staff',
            vehicles: 'vehicles',
            fieldTrips: 'fieldTrips'
        };
        return mapping[type] || type;
    }

    // Export functionality
    exportData(type, format = 'csv') {
        try {
            const data = this.getExportData(type);
            
            if (format === 'csv') {
                return this.exportToCSV(data, type);
            } else if (format === 'json') {
                return this.exportToJSON(data, type);
            } else {
                throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error('Export failed:', error);
            this.eventBus.emit('data:export-error', error);
            throw error;
        }
    }

    getExportData(type) {
        const stateKey = this.getStateKey(type);
        return getState(stateKey) || [];
    }

    exportToCSV(data, type) {
        if (data.length === 0) {
            throw new Error('No data to export');
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header] || '';
                    return `"${value.toString().replace(/"/g, '""')}"`;
                }).join(',')
            )
        ].join('\n');

        this.downloadFile(csvContent, `${type}-export-${formatDate(new Date())}.csv`, 'text/csv');
        return csvContent;
    }

    exportToJSON(data, type) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `${type}-export-${formatDate(new Date())}.json`, 'application/json');
        return jsonContent;
    }

    generateTemplate(type) {
        const schemas = this.getValidationSchemas();
        const schema = schemas[type];
        
        if (!schema) {
            throw new Error(`No template available for type: ${type}`);
        }

        const headers = Object.keys(schema);
        const sampleRow = headers.map(header => {
            const rules = schema[header];
            if (rules.type === 'number') return '0';
            if (rules.type === 'date') return '2025-01-01';
            return 'Sample Value';
        });

        const csvContent = [
            headers.join(','),
            sampleRow.join(',')
        ].join('\n');

        this.downloadFile(csvContent, `${type}-template.csv`, 'text/csv');
        return csvContent;
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Validation utilities
    validateData(data, schema) {
        try {
            const validated = data.map((row, index) => 
                this.validateRow(row, schema, index + 1)
            );
            return { valid: true, data: validated };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}

// Create and export singleton instance
export const importExportManager = new ImportExportManager();
export default importExportManager;
